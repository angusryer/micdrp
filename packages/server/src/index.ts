import { configDotenv } from 'dotenv';
import Server from './server';

configDotenv();

const PORT = process.env.PORT;

const { server } = new Server();
server.listen(PORT, () =>
  console.info('Server running on port ' + String(PORT))
);
