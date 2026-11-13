// The listing spec field map (API field → label → group → formatter) lives in
// api/_lib/specFields.ts so the server-rendered listing page (api/listing.ts)
// and this React page build the same table from one definition.
//
// To show a new field, add one line to SPEC_FIELDS there.
export * from '../../api/_lib/specFields';
