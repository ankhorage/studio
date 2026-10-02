import {
  runExpo57AuthHiddenRouteDrawerAcceptanceAsync,
  runExpo57GeneratedNavigationAcceptanceAsync,
} from '../test/smoke/runExpo57GeneratedNavigationAcceptance';

if (process.argv.includes('--auth-hidden-route-drawer')) {
  await runExpo57AuthHiddenRouteDrawerAcceptanceAsync();
} else {
  await runExpo57GeneratedNavigationAcceptanceAsync();
}
