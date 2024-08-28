import { DocumentHandler } from './components/documentHandler';
import { QuickstartPlayground } from './components/quickstartPlayground';
const dotenv = require('dotenv');
dotenv.config();

const quickstartPlaygroundInstance = new QuickstartPlayground();

quickstartPlaygroundInstance.setupExampleDocs();