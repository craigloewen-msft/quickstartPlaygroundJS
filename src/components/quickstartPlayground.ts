import { AzureOpenAI } from "openai";
import { DocumentHandler } from "./documentHandler";
import { prompt } from "enquirer";
import { ChatCompletionCreateParams, ChatCompletionTool, FunctionDefinition } from "openai/resources";

interface PromptResponse {
    chatMessage: string;
}

interface ProjectDescriptionResponse {
    projectDescription: string;
}

export class QuickstartPlayground {
    private endpoint: string;
    private apiKey: string;
    private deployment: string;
    private embeddingsDeployment: string;
    private apiVersion: string;
    private client: AzureOpenAI;
    private embeddingsClient: AzureOpenAI;
    private documentHandler: DocumentHandler;

    constructor() {
        this.endpoint = process.env.AZURE_AI_ENDPOINT || "";
        this.apiKey = process.env.AZURE_AI_API_KEY || "";
        this.deployment = process.env.AZURE_AI_DEPLOYMENT || "";
        this.embeddingsDeployment = process.env.AZURE_AI_EMBEDDINGS_DEPLOYMENT || "";
        this.apiVersion = "2024-04-01-preview";
        const client = new AzureOpenAI({ endpoint: this.endpoint, apiKey: this.apiKey, apiVersion: this.apiVersion, deployment: this.deployment });
        const embeddingsClient = new AzureOpenAI({ endpoint: this.endpoint, apiKey: this.apiKey, apiVersion: this.apiVersion, deployment: this.embeddingsDeployment });
        this.client = client;
        this.embeddingsClient = embeddingsClient;

        this.documentHandler = new DocumentHandler();
    }

    async setupExampleDocs() {
        console.log("Exporting samples");
        this.documentHandler.createProjectExportsFromSampleFolder();
        console.log("Getting embeddings");
        await this.documentHandler.getEmbeddingsForAllDocs(this.embeddingsClient);
        console.log("Saving changes");
        this.documentHandler.saveChanges();
    }

    private async callAI(inputMessageArray) {
        const result = await this.client.chat.completions.create({
            messages: inputMessageArray,
            temperature: 0.001,
            model: "",
        });

        return result.choices[0].message.content;
    }

    private async callAIWithTools(inputMessageArray) {
        const createDevProjectFunction: FunctionDefinition = {
            name: "create_dev_project",
            description: "Creates a developer project based on an input project description.",
            parameters: {
                type: 'object',
                properties: {
                    projectDescription: {
                        type: "string",
                        description: "The description of the project to create"
                    }
                },
                required: ["projectDescription"]
            }
        };

        const toolDefinition: ChatCompletionTool = {
            type: "function",
            function: createDevProjectFunction
        }

        const tools = [toolDefinition];

        const result = await this.client.chat.completions.create({
            messages: inputMessageArray,
            temperature: 0.001,
            model: "",
            tools: tools
        });

        return result;
    }

    private async getMostSimilarProjects(inputPrompt: string, numberOfProjects: number) {

        let promptEmbeddingResponse = await this.embeddingsClient.embeddings.create({
            model: "textembeddingsmall",
            input: [inputPrompt],
        });

        let promptEmbedding = promptEmbeddingResponse.data[0].embedding;

        let results = this.documentHandler.getMostSimilarDocs(promptEmbedding, numberOfProjects);
        let returnArray = [];
        for (let i = 0; i < numberOfProjects; i++) {
            returnArray.push(results[i].doc);
        }

        return returnArray;
    }

    private async getDevContainerFiles(projectDescription, mostSimilarProjects: any[]) {
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

Output just the file names, and file contents and nothing else. Do not output any markdown.` },
        ];

        for (let i = 0; i < mostSimilarProjects.length; i++) {
            const project = mostSimilarProjects[i];
            messages.push({ role: "user", content: project.prompt });
            messages.push({ role: "assistant", content: project.codespaces });
        }
        messages.push({ role: "user", content: projectDescription });

        return await this.callAI(messages);
    }

    private async getStarterCode(projectDescription, mostSimilarProjects: any[]) {
        let messages = [
            {
                role: "system", content: `Your task is to create a VS Code Codespaces starting project for a repository given a sample prompt. You will be given the VS Code Spaces definition for your project for reference and an example prompt and example code. You will output the source code for the app itself to satisfy your given prompt. 

The example is only shown as inspiration, you do not need to incorporate it.

Please format your output using the same file and folder format as the example. Do not output anything besides the answer to the prompt.` }
        ];

        for (let i = 0; i < mostSimilarProjects.length; i++) {
            const project = mostSimilarProjects[i];
            messages.push({ role: "user", content: project.prompt });
            messages.push({ role: "assistant", content: project.code });
        }
        messages.push({ role: "user", content: projectDescription });

        return await this.callAI(messages);
    }

    async createProject(projectDescription) {
        console.log("Getting most similar project...");
        const mostSimilarProjects = await this.getMostSimilarProjects(projectDescription, 3);

        console.log("Getting dev container files...");
        const devContainerFiles = await this.getDevContainerFiles(projectDescription, mostSimilarProjects);

        console.log("Getting starter code...");
        const starterCode = await this.getStarterCode(projectDescription, mostSimilarProjects);

        console.log("Creating project...");
        this.documentHandler.createProjectFromString(devContainerFiles + "\n" + starterCode);
    }

    async chatCreateProject() {

        let chatMessages = [];

        chatMessages.push({
            role: "system",
            content: `You are an agent that helps someone get started with a developer project quickly. 
            
# Instructions

- The user will provide an initial description of what developer project they want to create.
- You will ensure the project description will have these qualities:
   - A chosen programming language and framework (Or specified that the best can be chosen)
   - A basic goal and description. The app should be somewhat basic and shouldn't be too complicated.
- If the user doesn't provide this info initially you will ask for it. 
- If the user gives a project that you don't think is successful you will direct them to fix their prompt. 
- Unsuccesful projects include:
   - Too complicated or unrealistic. 
   - Trying to run a command (like git clone).
- When you have a successful prompt you will call the 'create_dev_project' function with the prompt.
- If the user insists that they'd like to continue their project then let them.
   
# Examples 

## Example 1

### User
I want to create a basic web app that uses React. The app will be a simple to do list.

### Agent
Call the create_dev_project function with the projectDescription: 'Create a simple to do list web application using React.'

## Example 2

### User
git clone https://github.com/microsoft/wsl

### Agent
Please provide a description of the project you would like to create, this service cannot execute commands.

## Example 3

### User
I want to create a neural network machine learning app that would develop a cyber security platform. 

### Agent
This service aims to develop simple example and getting started projects. Can you please provide a simpler project?

## Example 4    

### User
Make a minesweeper game in Python

### Agent
Call the create_dev_project function with the projectDescription: 'Make a minesweeper game in Python.'`
        });

        let projectDescription = '';

        console.log("AI Assistant:\nWhat kind of developer project would you like to create?");

        while (projectDescription === '') {

            let promptResponse: PromptResponse = await prompt({
                type: 'input',
                name: 'chatMessage',
                message: 'Reply: ',
            });

            chatMessages.push({ role: "user", content: promptResponse.chatMessage });

            let aiResponse = await this.callAIWithTools(chatMessages);

            let toolCallExists = aiResponse.choices[0].message.tool_calls?.length;

            if (toolCallExists) {
                let jsonStringResponse: string = aiResponse.choices[0].message.tool_calls[0].function.arguments;
                let jsonObjectResponse: ProjectDescriptionResponse = JSON.parse(jsonStringResponse);
                projectDescription = jsonObjectResponse.projectDescription;

            } else {
                chatMessages.push({ role: "assistant", content: aiResponse.choices[0].message.content });
                console.log("AI Assistant:\n" + aiResponse.choices[0].message.content);
            }
        }

        console.log("AI Assistant:\nCreating a project with the following description: " + projectDescription);
        this.createProject(projectDescription);
    }
}