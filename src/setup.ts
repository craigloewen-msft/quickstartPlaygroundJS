import { DocumentHandler } from './components/documentHandler';
import { QuickstartPlayground } from './components/quickstartPlayground';
const dotenv = require('dotenv');
dotenv.config();

const docHandler = new DocumentHandler();
const quickstartPlaygroundInstance = new QuickstartPlayground();

async function main() {
    await docHandler.getEmbeddingsForAllDocs(quickstartPlaygroundInstance.getAzureOpenAIEmbeddings());
    docHandler.saveChanges();
}

main()