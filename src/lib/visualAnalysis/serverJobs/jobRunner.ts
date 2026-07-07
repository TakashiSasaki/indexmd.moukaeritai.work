import { jobStore } from './jobStore';
import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';
import { analyzePublicSample } from '../../../../server'; // We will export it from server.ts and import it. Wait, importing from server.ts is bad because it might cause circular dependencies or start the server again.
