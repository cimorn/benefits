// The official Mongo entrypoint executes this only for a new data directory.
// Credentials are supplied privately and must never be printed.
const BenefitsStorageURL = require('url').URL;
let benefitsUri;
try {
  benefitsUri = new BenefitsStorageURL(process.env.MONGODB_URI);
} catch {
  throw new Error('Benefits application database configuration is invalid');
}
if (
  benefitsUri.protocol !== 'mongodb:' ||
  decodeURIComponent(benefitsUri.username) !== 'benefits_app' ||
  benefitsUri.pathname !== '/benefits' ||
  benefitsUri.searchParams.get('authSource') !== 'benefits' ||
  !benefitsUri.password
) {
  throw new Error('Benefits application database configuration is invalid');
}
const benefitsDatabase = db.getSiblingDB('benefits');
if (benefitsDatabase.getUser('benefits_app')) {
  throw new Error('Benefits database initialization requires an empty application account');
}
benefitsDatabase.createUser({
  user: 'benefits_app',
  pwd: decodeURIComponent(benefitsUri.password),
  roles: [{ role: 'readWrite', db: 'benefits' }]
});
