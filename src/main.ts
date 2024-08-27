const { prompt } = require('enquirer')
const dotenv = require('dotenv');
import { QuickstartPlayground } from './components/quickstartPlayground';

dotenv.config();
const playgroundInstance = new QuickstartPlayground();

prompt({
    type: 'input',
    name: 'projectDescription',
    message: 'Enter what kind of project you would like to develop',
}).then(({ projectDescription }) => {
    playgroundInstance.createProject(projectDescription)
})
    .catch(console.error)

