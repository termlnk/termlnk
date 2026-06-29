// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from './20260608122835_init/migration.sql';
import m0001 from './20260612162940_fat_polaris/migration.sql';
import m0002 from './20260617004320_add_snippet/migration.sql';
import m0003 from './20260627155004_superb_grey_gargoyle/migration.sql';
import m0004 from './20260628010000_rebuild_ai_provider/migration.sql';

export default {
  migrations: {
    '20260608122835_init': m0000,
    '20260612162940_fat_polaris': m0001,
    '20260617004320_add_snippet': m0002,
    '20260627155004_superb_grey_gargoyle': m0003,
    '20260628010000_rebuild_ai_provider': m0004,
  },
};
