// External startup adapter: no import is added to the application entry point.
require('@beacon-observability/nodejs/register');
require('./correlate-logs.cjs');
