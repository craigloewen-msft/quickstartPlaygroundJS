import { AzureOpenAI } from "openai";
import { QuickstartPlayground } from "./quickstartPlayground";
const fs = require("fs");
const path = require("path");

export class DocumentHandler {
    documentData: any;
    documentDataPath: string;

    constructor() {
        this.documentData = {};
        this.documentDataPath = path.resolve(__dirname, "../../exampleDocuments/docsEmbeddings-OpenAI.json");
        this.loadDocumentData();
    }

    loadDocumentData() {
        const rawData = fs.readFileSync(this.documentDataPath, "utf-8");
        this.documentData = JSON.parse(rawData);
        console.log("Loaded data");
    }

    saveChanges() {
        fs.writeFileSync(this.documentDataPath, JSON.stringify(this.documentData, null, 2), "utf-8");
    }

    // Credit: https://stackoverflow.com/questions/51362252/javascript-cosine-similarity-function
    private cosinesim(A: any, B: any) {
        var dotproduct = 0;
        var mA = 0;
        var mB = 0;

        for (var i = 0; i < A.length; i++) {
            dotproduct += A[i] * B[i];
            mA += A[i] * A[i];
            mB += B[i] * B[i];
        }

        mA = Math.sqrt(mA);
        mB = Math.sqrt(mB);
        var similarity = dotproduct / (mA * mB);

        return similarity;
    }

    getMostSimilarDocs(inputEmbedding: number[], numberOfDocsToReturn: number) {
        let results = [];

        for (let i = 0; i < this.documentData.length; i++) {
            const doc = this.documentData[i];
            const similarity = this.cosinesim(inputEmbedding, doc.embedding);
            results.push({ similarity, doc });
        }

        results.sort((a, b) => {
            return b.similarity - a.similarity;
        });

        return results.slice(0, numberOfDocsToReturn);
    }

    async getEmbeddingsForAllDocs(embeddingsService: AzureOpenAI) {
        console.log("Getting embeddings for all documents");
        for (let i = 0; i < this.documentData.length; i++) {
            const doc = this.documentData[i];

            const embeddingValue = await embeddingsService.embeddings.create({
                model: "textembeddingsmall",
                input: [doc.prompt],
            });

            doc.embedding = embeddingValue.data[0].embedding;
        }


        return true;
    }

    createProjectFromString(projectDescription: string) {
        const outputDir = path.resolve(__dirname, '../../quickstartOutput');

        // Ensure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        } else {
            // Clear out any existing files
            fs.rmdirSync(outputDir, { recursive: true });
            fs.mkdirSync(outputDir);
        }

        const lines = projectDescription.split('\n');
        let currentFileName = '';
        let currentFileContent = '';

        const fileRegex = /^=== (.*?) ===$/;

        let inBackticks = false;

        lines.forEach(line => {
            const match = line.match(fileRegex);
            if (match) {
                // If there's an existing file being processed, write it to disk
                if (currentFileName) {
                    const filePath = path.join(outputDir, currentFileName);
                    const fileDir = path.dirname(filePath);

                    // Ensure the directory exists, creating it if necessary
                    if (!fs.existsSync(fileDir)) {
                        fs.mkdirSync(fileDir, { recursive: true });
                    }

                    fs.writeFileSync(filePath, currentFileContent.trim(), 'utf-8');
                }
                // Start a new file
                currentFileName = match[1].trim();
                currentFileContent = '';
            } else {
                // Append line to the current file content
                if (line != '````') {
                    currentFileContent += line + '\n';
                }
            }
        });

        // Write the last file if any
        if (currentFileName) {
            const filePath = path.join(outputDir, currentFileName);
            const fileDir = path.dirname(filePath);

            // Ensure the directory exists, creating it if necessary
            if (!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir, { recursive: true });
            }

            fs.writeFileSync(filePath, currentFileContent.trim(), 'utf-8');
        }
    }

    createProjectExportsFromSampleFolder() {
        const sampleFolder = path.resolve(__dirname, '../../exampleDocuments/Samples');

        const processFolder = (folderPath: string, folderPathString: string, folderInfo: any): any => {
            const folderName = path.basename(folderPath);
            if (folderInfo.name === "") {
                folderInfo.name = folderName;
            }

            fs.readdirSync(folderPath).forEach(item => {
                const itemPath = path.join(folderPath, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    const childFolderContentObject = processFolder(itemPath, `${folderPathString}/${item}`, folderInfo);
                } else {
                    const fileContent = fs.readFileSync(itemPath, "utf-8");
                    const templatedFileContent = `=== ${folderPathString}/${item} ===\n\`\`\`\`\n${fileContent}\n\`\`\`\`\n\n`;

                    if (item === "devquickstartplaygroundprompt.txt") {
                        folderInfo.prompt = fileContent
                    } else if (item === "devquickstartplaygroundlanguage.txt") {
                        folderInfo.language = fileContent
                    } else if (item.includes("README")) {
                        folderInfo.readme += templatedFileContent;
                    } else if (folderPathString.includes(".devcontainer")) {
                        folderInfo.codespaces += templatedFileContent;
                    } else {
                        folderInfo.code += templatedFileContent;
                    }
                }
            });

            return folderInfo;
        };

        const projectExports = fs.readdirSync(sampleFolder).map(folder => {
            const folderPath = path.join(sampleFolder, folder);
            let folderInfo = { name: "", codespaces: "", readme: "", code: "", prompt: "", language: "", embedding: [] };
            return processFolder(folderPath, '.', folderInfo);
        });

        this.documentData = projectExports;
    }
}