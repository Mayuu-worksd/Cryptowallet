import './utils/getRandomValuesShim';
import { Buffer } from 'buffer';
import { registerRootComponent } from 'expo';
import App from './App';

global.Buffer = global.Buffer || Buffer;

registerRootComponent(App);
