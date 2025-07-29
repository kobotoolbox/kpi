import {
  generateSchemaTypes,
  generateReactQueryComponents,
} from "@openapi-codegen/typescript";
import { defineConfig } from "@openapi-codegen/cli";
export default defineConfig({
  v2: {
    from: {
      relativePath: "./api.yaml",
      source: "file",
    },
    outputDir: "./jsapp/api",
    to: async (context) => {
      const filenamePrefix = "v2";
      const { schemasFiles } = await generateSchemaTypes(context, {
        filenamePrefix,
      });
      await generateReactQueryComponents(context, {
        filenamePrefix,
        schemasFiles,
      });
    },
  },
});
