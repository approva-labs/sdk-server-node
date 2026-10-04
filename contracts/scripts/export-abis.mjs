import { mkdir, readFile, writeFile } from "node:fs/promises";

await mkdir("./abi", { recursive: true });

for (const name of ["ApprovaAuthorization", "ApprovaForwarder"]) {
  const artifact = JSON.parse(
    await readFile(`./out/${name}.sol/${name}.json`, "utf8")
  );

  await writeFile(
    `./abi/${name}.json`,
    JSON.stringify(artifact.abi, null, 2)
  );

  console.log(`✓ ${name} ABI -> abi/${name}.json`);
}
