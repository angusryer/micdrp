import { readFileSync } from 'fs';
import { join } from 'path';

import { SESSION_ROUTES } from '../dto/session';

const hooks = readFileSync(
  join(__dirname, '../../../../backend/pb_hooks/session.pb.js'),
  'utf8'
);

describe('SESSION_ROUTES', () => {
  it.each(Object.entries(SESSION_ROUTES))(
    'the backend serves %s at the route the client calls',
    (_name, route) => {
      expect(hooks).toContain(`routerAdd("POST", "${route}"`);
    }
  );
});
