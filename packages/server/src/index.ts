import Server from './server';

const { server } = new Server();
server.listen(8080, () => console.info('Server running on port 8080'));
