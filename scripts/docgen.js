import fs from "fs-extra";
import fg from "fast-glob";
import { renderPages } from "jsii-docgen";
import jsiiReflect from "jsii-reflect";
import path from "path";
import yargs from "yargs";

const cdkVersion = "latest";

const isLocalFqn = (type) => type.fqn.startsWith("@cdk-seed");
const getCleanedFqn = (type) => type.fqn.replace("/", "_");
const getRelLink = (type) => `./${getCleanedFqn(type)}.md`;
const getCdkLink = (type) =>
  `https://docs.aws.amazon.com/cdk/api/${cdkVersion}/docs/` +
  `${getCleanedFqn(type)}.html`;

async function renderFiles(jsiiFiles, outdir) {
  const ctx = {
    links: {
      renderLink: (type) =>
        isLocalFqn(type) ? getRelLink(type) : getCdkLink(type),
    },
  };

  const ts = new jsiiReflect.TypeSystem();
  for (const filePath of jsiiFiles) {
    await ts.load(filePath);
  }

  const pages = await renderPages(ts, ctx);
  for (const page of pages) {
    if (!isLocalFqn(page.type)) continue;
    console.log(page.type.fqn);

    const header = buildHeader(page.type);
    const filePath = path.join(outdir, getRelLink(page.type));
    await fs.mkdirp(path.dirname(filePath));
    await fs.writeFile(filePath, header + page.markdown, { encoding: "utf-8" });
  }
}

async function main() {
  const args = yargs
    .usage("Usage: $0 [GLOB-PATTERN,...]")
    .option("output", {
      type: "string",
      alias: "o",
      required: false,
      desc: 'Output directory or file (default directory is "dist")',
    })
    .example(
      "$0 'node_modules/**/.jsii'",
      "Generate documentation for all jsii modules in your project"
    ).argv;

  const output = args.output ?? "dist";
  const jsiiFiles = await fg(args._);
  await renderFiles(jsiiFiles, output);
}

function buildHeader(type) {
  const packageName = type.fqn.split(".")[0];
  const headerObj = {
    title: JSON.stringify(type.name),
    ...(type.fqn === type.name
      ? { has_children: true }
      : { parent: JSON.stringify(packageName) }),
  };
  const headerStr = Object.entries(headerObj).reduce(
    (acc, [k, v]) => acc + `${k}: ${v}\n`,
    ""
  );
  return "---\n" + headerStr + "---\n";
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
