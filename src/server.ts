import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Database } from './db/database';
import { createTaskRouter } from './routes/tasks';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = new Database(process.env.DATABASE_URL || './data/tasks.sqlite3');

app.use('/api/tasks', createTaskRouter(db));
app.use(errorHandler);

db.initialize().then(() => {
  app.listen(port, () => console.log(`Server running on port ${port}`));
});
