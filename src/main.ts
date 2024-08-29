const { prompt } = require('enquirer')
const dotenv = require('dotenv');
import { QuickstartPlayground } from './components/quickstartPlayground';

dotenv.config();
const playgroundInstance = new QuickstartPlayground();

playgroundInstance.chatCreateProject();