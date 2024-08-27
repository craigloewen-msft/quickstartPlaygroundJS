import { AzureOpenAI } from "openai";
import { QuickstartPlayground } from "./quickstartPlayground";
const fs = require("fs");
const path = require("path");

export class DocumentHandler {
    private documentData: any;

    constructor() {
        this.documentData = {};
        this.loadDocumentData();
    }

    // Load JSON data from the file
    loadDocumentData() {
        const filePath = path.resolve(__dirname, "../../exampleDocuments/docsEmbeddings-OpenAI.json");
        const rawData = fs.readFileSync(filePath, "utf-8");
        this.documentData = JSON.parse(rawData);
        console.log("Loaded data");
    }

    // Save changes to the JSON file
    saveChanges() {
        const filePath = path.resolve(__dirname, "../../exampleDocuments/docsEmbeddings-OpenAI.json");
        fs.writeFileSync(filePath, JSON.stringify(this.documentData, null, 2), "utf-8");
    }

    // Get embeddings for all documents
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
}