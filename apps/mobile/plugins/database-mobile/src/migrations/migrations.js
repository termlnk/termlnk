// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from './20260608122835_init/migration.sql';
import m0001 from './20260611062505_add_snippet_and_port_forwarding/migration.sql';

  export default {
    migrations: {
      "20260608122835_init": m0000,
"20260611062505_add_snippet_and_port_forwarding": m0001
}
  }
  
