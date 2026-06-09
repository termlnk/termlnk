const { withPodfile } = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-ios-hermes-v1-env';
const HERMES_V1_ENV_LINE = "ENV['RCT_HERMES_V1_ENABLED'] ||= podfile_properties['expo.useHermesV1'] == 'false' ? '0' : '1'";
const RNCORE_ENV_LINE = "ENV['RCT_USE_PREBUILT_RNCORE'] ||= podfile_properties['ios.buildReactNativeFromSource'] == 'true' ? '0' : '1'";
const NETWORK_INSPECTOR_ENV_LINE = "ENV['EX_DEV_CLIENT_NETWORK_INSPECTOR'] ||= podfile_properties['EX_DEV_CLIENT_NETWORK_INSPECTOR']";

function addHermesV1Env(contents) {
  if (contents.includes("ENV['RCT_HERMES_V1_ENABLED']")) {
    return contents;
  }

  if (contents.includes(RNCORE_ENV_LINE)) {
    return contents.replace(RNCORE_ENV_LINE, `${RNCORE_ENV_LINE}\n${HERMES_V1_ENV_LINE}`);
  }

  if (contents.includes(NETWORK_INSPECTOR_ENV_LINE)) {
    return contents.replace(
      NETWORK_INSPECTOR_ENV_LINE,
      `${NETWORK_INSPECTOR_ENV_LINE}\n${HERMES_V1_ENV_LINE}`,
    );
  }

  throw new Error(`${PLUGIN_NAME}: unable to locate Podfile environment variable block`);
}

const withIosHermesV1Env = (config) => {
  return withPodfile(config, (config) => {
    config.modResults.contents = addHermesV1Env(config.modResults.contents);
    return config;
  });
};

module.exports = withIosHermesV1Env;
