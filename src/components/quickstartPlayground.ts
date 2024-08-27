import { AzureOpenAI } from "openai";

export class QuickstartPlayground {
    private endpoint: string;
    private apiKey: string;
    private deployment: string;
    private embeddingsDeployment: string;
    private client: AzureOpenAI;
    private apiVersion: string;

    constructor() {
        this.endpoint = process.env.AZURE_AI_ENDPOINT || "";
        this.apiKey = process.env.AZURE_AI_API_KEY || "";
        this.deployment = process.env.AZURE_AI_DEPLOYMENT || "";
        this.embeddingsDeployment = process.env.AZURE_AI_EMBEDDINGS_DEPLOYMENT || "";
        this.apiVersion = "2024-04-01-preview";
        const client = new AzureOpenAI({ endpoint: this.endpoint, apiKey: this.apiKey, apiVersion: this.apiVersion, deployment: this.deployment });
        this.client = client;
    }

    getAzureOpenAIEmbeddings() {
        return new AzureOpenAI({ endpoint: this.endpoint, apiKey: this.apiKey, apiVersion: this.apiVersion, deployment: this.embeddingsDeployment });
    }

    async callAI(inputMessageArray) {
        const result = await this.client.chat.completions.create({
            messages: inputMessageArray,
            model: "",
        });

        return result.choices[0].message.content;
    }

    async getDevContainerFiles(projectDescription) {
        let messages = [
            {
                role: "system", content: `Your task is to create a VS Code Codespaces definition from a given prompt. You only need to output files for the .devcontainer folder, not source code for the app itself.

You will be shown example prompts, they are just there to show already working examples, do not feel the need to incorporate them and disregard them if needed. 

Remember that VS Code dev containers automatically copy over the source code from the input folder to the repo, and do not need COPY commands.
In your Dockerfile do not include any COPY commands.

When filling in the RUN command, if there are multiple libraries to install, put them all into the same package manager install command.
In your Dockerfile do not have multiple package manager install commands in the RUN section and do not duplicate packages.

Any commands to install requirements based on repo files must be put in the devcontainer.json file as a 'postCreateCommand'.
For example, do NOT put a \`COPY requirements.txt .\` line in the Dockerfile. Put a \`'postCreateCommand': 'pip3 install -r requirements.txt'\` line in devcontainer.json.

Please pick the best language and best tools and frameworks necessary to match the prompt.

Output just the file names, and file contents and nothing else.` },
            { role: "user", content: "Create a bitcoin price tracker using Python" },
            { role: "assistant", content: "=== ./.devcontainer/devcontainer.json ===\n{\n    \"name\": \"Python 3 Bitcoin Price Tracker\",\n    \"build\": {\n        \"dockerfile\": \"Dockerfile\"\n    },\n    \"customizations\": {\n        // Configure properties specific to VS Code.\n        \"vscode\": {\n            \"settings\": {},\n            \"extensions\": [\n                \"ms-python.python\"\n            ]\n        }\n    },\n    \"postCreateCommand\": \"pip3 install -r requirements.txt\"\n}\n\n=== ./.devcontainer/Dockerfile ===\nFROM mcr.microsoft.com/devcontainers/base:ubuntu\n\nENV DEBIAN_FRONTEND noninteractive\n\nRUN apt update && \\\napt install -y python3-pip python3-tk" },
            { role: "user", content: projectDescription },
        ];

        return await this.callAI(messages);
    }

    async getStarterCode(projectDescription) {
        let messages = [
            {
                role: "system", content: `Your task is to create a VS Code Codespaces starting project for a repository given a sample prompt. You will be given the VS Code Spaces definition for your project for reference and an example prompt and example code. You will output the source code for the app itself to satisfy your given prompt. 

The example is only shown as inspiration, you do not need to incorporate it.

Please format your output using the same file and folder format as the example. Do not output anything besides the answer to the prompt.` },
            { role: "user", content: "Create a bitcoin price tracker using Python" },
            { role: "assistant", content: "\n\n=== ./price_tracker.py ===\nimport requests\n\nurl = 'https://api.coindesk.com/v1/bpi/currentprice.json'\n\nresponse = requests.get(url)\ndata = response.json()\n\nprint(\"Bitcoin Price: $\" + data['bpi']['USD']['rate'])\n\n=== ./requirements.txt ===\nrequests\n\n=== ./.vscode/launch.json ===\n{\n    \"version\": \"0.2.0\",\n    \"configurations\": [\n        {\n            \"name\": \"Python: Bitcoin Price Tracker\",\n            \"type\": \"python\",\n            \"request\": \"launch\",\n            \"program\": \"price_tracker.py\"\n        }\n    ]\n}" },
            { role: "user", content: projectDescription },
        ];

        return await this.callAI(messages);
    }

    async createProject(projectDescription) {

        // Get most similar project
        const devContainerFiles = await this.getDevContainerFiles(projectDescription);
        const starterCode = await this.getStarterCode(projectDescription);

        // Combine result and decipher into file structure
        console.log("Done");
    }
}