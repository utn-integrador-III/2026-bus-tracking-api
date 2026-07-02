"use strict";

const express = require("express");
const { getServiceClient, getAnonClient } = require("../../../database/supabaseClient");
const { ROLES } = require("../../../constants/roles");
const userRepository = require("../../../repositories/userRepository");
const passengerRepository = require("../../../repositories/passengerRepository");
const authAuditRepository = require("../../../repositories/authAuditRepository");
const validate = require("../../../middleware/validate");
const requireAuth = require("../../../middleware/requireAuth");
const { registerPassengerSchema, loginSchema, oauthStartSchema } = require("../../../models/auth.model");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");
const AppError = require("../../../utils/AppError");
const asyncHandler = require("../../../utils/asyncHandler");
const SupabaseUserRepository = require("./infrastructure/SupabaseUserRepository");
const SupabasePassengerProfileRepository = require("./infrastructure/SupabasePassengerProfileRepository");
const SupabaseAuthAuditRepository = require("./infrastructure/SupabaseAuthAuditRepository");

const PASSENGER_ROLE = ROLES.PASSENGER;
const ROLE_CAPABILITIES = Object.freeze({
  [ROLES.ADMIN]: ["admin:routes", "admin:trips", "auth:admin"],
  [ROLES.DRIVER]: ["driver:trips", "passenger:routes", "passenger:trips"],
  [ROLES.PASSENGER]: ["passenger:routes", "passenger:trips", "passenger:incidents"],
});

function buildSessionPayload(user) {
  return {
    user_id: user.id,
    email: user.email,
    role: user.role,
    capabilities: ROLE_CAPABILITIES[user.role] || [],
  };
}

class AuthIdentityProvider {
  async registerPassenger(_payload) {
    throw new Error("AuthIdentityProvider.registerPassenger must be implemented.");
  }

  async login(_payload) {
    throw new Error("AuthIdentityProvider.login must be implemented.");
  }

  async startOAuth(_payload) {
    throw new Error("AuthIdentityProvider.startOAuth must be implemented.");
  }
}

class SupabaseAuthIdentityProvider extends AuthIdentityProvider {
  async registerPassenger(payload) {
    return getServiceClient().auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        name: payload.name,
        role: PASSENGER_ROLE,
      },
    });
  }

  async login(payload) {
    return getAnonClient().auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });
  }

  async startOAuth(payload) {
    return getAnonClient().auth.signInWithOAuth({
      provider: payload.provider,
      options: {
        redirectTo: payload.redirect_to,
        skipBrowserRedirect: true,
      },
    });
  }
}

class AuthService {
  constructor(dependencies = {}) {
    this.identityProvider = dependencies.identityProvider || new SupabaseAuthIdentityProvider();
    this.userRepository = dependencies.userRepository || userRepository;
    this.passengerRepository = dependencies.passengerRepository || passengerRepository;
    this.authAuditRepository = dependencies.authAuditRepository || authAuditRepository;
  }

  async writeLoginAudit(payload) {
    await this.authAuditRepository.createLoginAuditLog(payload);
  }

  normalizeUserRole(authUser, dbUser) {
    if (dbUser && dbUser.role) {
      return dbUser.role;
    }
    if (!authUser) {
      return null;
    }
    const appMetadata = authUser.app_metadata || {};
    const userMetadata = authUser.user_metadata || {};
    const role = appMetadata.role || userMetadata.role || null;
    return role;
  }

  buildLoginResponse(session, authUser, dbUser) {
    const role = this.normalizeUserRole(authUser, dbUser);
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: {
        id: authUser.id,
        email: authUser.email,
        role,
        name: dbUser && dbUser.name ? dbUser.name : authUser.user_metadata ? authUser.user_metadata.name : null,
      },
      capabilities: ROLE_CAPABILITIES[role] || [],
    };
  }

  async registerPassenger(payload) {
    const existingUser = await this.userRepository.findUserByEmail(payload.email);

    if (existingUser) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.AUTH_EMAIL_EXISTS,
        "A user with this email already exists.",
      );
    }

    const { data, error } = await this.identityProvider.registerPassenger(payload);

    if (error || !data || !data.user) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.AUTH_REGISTER_FAILED,
        "Passenger authentication account could not be created.",
        error ? error.message : undefined,
      );
    }

    const userProfile = await this.userRepository.createUserProfile({
      id: data.user.id,
      name: payload.name,
      email: payload.email,
      role: PASSENGER_ROLE,
    });

    const passengerProfile = await this.passengerRepository.createPassengerProfile({
      user_id: data.user.id,
      phone: payload.phone || null,
    });

    return {
      user: userProfile,
      passenger: passengerProfile,
    };
  }

  async loginUser(payload, context = {}) {
    const { data, error } = await this.identityProvider.login(payload);

    if (error || !data || !data.session || !data.user) {
      await this.writeLoginAudit({
        user_id: null,
        email: payload.email,
        role: null,
        auth_strategy: "password",
        oauth_provider: null,
        was_successful: false,
        failure_code: ERROR_CODES.AUTH_LOGIN_FAILED,
        ip_address: context.ipAddress || null,
        user_agent: context.userAgent || null,
      });
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.AUTH_LOGIN_FAILED,
        "Invalid email or password.",
      );
    }

    const dbUser = await this.userRepository.findUserById(data.user.id);
    const result = this.buildLoginResponse(data.session, data.user, dbUser);

    await this.writeLoginAudit({
      user_id: data.user.id,
      email: data.user.email,
      role: result.user.role,
      auth_strategy: "password",
      oauth_provider: null,
      was_successful: true,
      failure_code: null,
      ip_address: context.ipAddress || null,
      user_agent: context.userAgent || null,
    });

    return result;
  }

  async loginAdmin(payload, context = {}) {
    const result = await this.loginUser(payload, context);
    if (result.user.role !== ROLES.ADMIN) {
      await this.writeLoginAudit({
        user_id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        auth_strategy: "password",
        oauth_provider: null,
        was_successful: false,
        failure_code: ERROR_CODES.AUTH_ADMIN_REQUIRED,
        ip_address: context.ipAddress || null,
        user_agent: context.userAgent || null,
      });
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.AUTH_ADMIN_REQUIRED,
        "This interface is restricted to pre-verified administrators.",
      );
    }
    return result;
  }

  async startOAuth(payload) {
    const { data, error } = await this.identityProvider.startOAuth(payload);
    if (error || !data || !data.url) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.AUTH_OAUTH_FAILED,
        "OAuth sign-in could not be started.",
        error ? error.message : undefined,
      );
    }
    return {
      provider: payload.provider,
      authorization_url: data.url,
    };
  }

  async getSession(auth) {
    const dbUser = await this.userRepository.findUserById(auth.userId);
    const role = dbUser && dbUser.role ? dbUser.role : auth.role;
    return buildSessionPayload({
      id: auth.userId,
      email: dbUser ? dbUser.email : null,
      role,
    });
  }
}

class AuthController {
  constructor(authService) {
    this.authService = authService;
    this.registerPassenger = asyncHandler(this.registerPassenger.bind(this));
    this.loginUser = asyncHandler(this.loginUser.bind(this));
    this.loginAdmin = asyncHandler(this.loginAdmin.bind(this));
    this.startOAuth = asyncHandler(this.startOAuth.bind(this));
    this.getSession = asyncHandler(this.getSession.bind(this));
  }

  buildRequestContext(req) {
    return {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
    };
  }

  async registerPassenger(req, res) {
    const result = await this.authService.registerPassenger(req.valid.body);

    res.status(HTTP_STATUS.CREATED).json({
      user_id: result.user.id,
      role: result.user.role,
      passenger: result.passenger,
    });
  }

  async loginUser(req, res) {
    const result = await this.authService.loginUser(req.valid.body, this.buildRequestContext(req));
    res.status(HTTP_STATUS.OK).json(result);
  }

  async loginAdmin(req, res) {
    const result = await this.authService.loginAdmin(req.valid.body, this.buildRequestContext(req));
    res.status(HTTP_STATUS.OK).json(result);
  }

  async startOAuth(req, res) {
    const result = await this.authService.startOAuth(req.valid.body);
    res.status(HTTP_STATUS.OK).json(result);
  }

  async getSession(req, res) {
    const result = await this.authService.getSession(req.auth);
    res.status(HTTP_STATUS.OK).json(result);
  }
}

function createAuthModule(dependencies = {}) {
  const authService =
    dependencies.authService ||
    new AuthService({
      ...dependencies,
      userRepository:
        dependencies.userRepository ||
        (dependencies.useConcreteRepository ? new SupabaseUserRepository() : userRepository),
      passengerRepository:
        dependencies.passengerRepository ||
        (dependencies.useConcreteRepository
          ? new SupabasePassengerProfileRepository()
          : passengerRepository),
      authAuditRepository:
        dependencies.authAuditRepository ||
        (dependencies.useConcreteRepository ? new SupabaseAuthAuditRepository() : authAuditRepository),
    });
  const authController = dependencies.authController || new AuthController(authService);

  return {
    authService,
    authController,
  };
}

function createAuthRouter(dependencies = {}) {
  const { authController } = createAuthModule(dependencies);
  const router = express.Router();

  router.post(
    "/register",
    validate({ body: registerPassengerSchema }, ERROR_CODES.AUTH_VALIDATION_FAILED),
    authController.registerPassenger,
  );

  router.post(
    "/login",
    validate({ body: loginSchema }, ERROR_CODES.AUTH_VALIDATION_FAILED),
    authController.loginUser,
  );

  router.post(
    "/admin/login",
    validate({ body: loginSchema }, ERROR_CODES.AUTH_VALIDATION_FAILED),
    authController.loginAdmin,
  );

  router.post(
    "/oauth/start",
    validate({ body: oauthStartSchema }, ERROR_CODES.AUTH_VALIDATION_FAILED),
    authController.startOAuth,
  );

  router.get("/session", requireAuth, authController.getSession);

  return router;
}

module.exports = {
  AuthIdentityProvider,
  SupabaseAuthIdentityProvider,
  AuthService,
  AuthController,
  createAuthModule,
  createAuthRouter,
};