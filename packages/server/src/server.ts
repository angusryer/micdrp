import express, { Application } from 'express';
import StatusRoutes from './routes/status';

export default class Server {
  public server: Application;
  private statusRoutes: StatusRoutes = new StatusRoutes();

  constructor() {
    this.server = express();
    this.start();
  }

  public async start(): Promise<void> {
    this.statusRoutes.routes(this.server);
  }
}
