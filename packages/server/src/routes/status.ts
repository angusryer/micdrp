import { Application, Request, Response } from 'express';

export default class StatusRoutes {
  public routes(app: Application) {
    return app.route('/api/v1/status').get((req: Request, res: Response) => {
      console.info('Status: OK');
      res.status(200).send({
        status: 'OK',
        data: req.query
      });
    });
  }
}
