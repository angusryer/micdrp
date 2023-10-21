import express, { Application } from 'express';
import StatusRoutes from './routes/status';

export default class Server {
  public server: Application;
  private statusRoutes: StatusRoutes = new StatusRoutes();

  constructor() {
    this.server = express();
    this.start();
  }

  public start(): void {
    this.statusRoutes.routes(this.server);
  }
}
