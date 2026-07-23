const PRESERVE_LINE_RE = [
  /^\/\/\s*@ts-(ignore|expect-error|nocheck|check)\b/,
  /^\/\/\s*eslint-(disable|enable)(-next-line|-line)?\b/,
  /^\/\/\s*prettier-ignore\b/,
  /^\/\/\s*biome-ignore\b/,
  /^\/\/\s*deno-lint-ignore\b/,
  /^\/\/\s*deno-fmt-ignore\b/,
  /^\/\/\s*tslint:(disable|enable)\b/,
  /^\/\/\s*c8\s+ignore\b/,
  /^\/\/\s*istanbul\s+ignore\b/,
  /^\/\/\/\s*</,
  /^\/\/#\s*sourceMappingURL=/,
];

const PRESERVE_BLOCK_RE = [
  /^\/\*\s*@ts-(ignore|expect-error|nocheck|check)\b/,
  /^\/\*\s*eslint-(disable|enable)(-next-line|-line)?\b/,
  /^\/\*\s*prettier-ignore\b/,
  /^\/\*\s*global\s/,
  /^\/\*\s*globals\s/,
  /^\/\*!\s*/,
];

function isPreserved(reconstructed) {
  if (reconstructed.startsWith("//")) {
    return PRESERVE_LINE_RE.some((re) => re.test(reconstructed));
  }
  if (reconstructed.startsWith("/*")) {
    return PRESERVE_BLOCK_RE.some((re) => re.test(reconstructed));
  }
  return false;
}

const noComments = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Politica del proyecto: prohibe comentarios y documentacion en codigo. Solo permite directivas funcionales del toolchain (ver tools/strip-comments.mjs).",
    },
    schema: [],
    messages: {
      noComment:
        "Comentarios prohibidos por politica del proyecto (cero comentarios / cero documentacion en codigo). Mueve la explicacion a un archivo .md o a la carpeta de documentacion. Directivas funcionales del toolchain (@ts-*, eslint-disable, prettier-ignore, /// <reference>, //# sourceMappingURL, /*! */, /* global */) estan exentas.",
    },
  },
  create(context) {
    return {
      "Program:exit"() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const comments = sourceCode.getAllComments();
        for (const comment of comments) {
          const reconstructed =
            comment.type === "Line"
              ? "//" + comment.value
              : "/*" + comment.value + "*/";
          if (!isPreserved(reconstructed)) {
            context.report({ node: comment, messageId: "noComment" });
          }
        }
      },
    };
  },
};

export default noComments;
