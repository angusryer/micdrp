import { Application, Request, Response } from 'express';

export default class StatusRoutes {
  public routes(app: Application) {
    return app.route('/status').get((req: Request, res: Response) => {
      return res.status(200).send({
        status: 'OK',
        data: req.query
      });
    });
  }
}
