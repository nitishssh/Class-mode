# Data safety and minors checklist

This is an engineering worksheet, not a legal opinion. The release owner must compare every answer
with the production server, third-party processor contracts, generated Android manifest, and Play
Console wording immediately before submission.

Official references:

- [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play Families policies](https://support.google.com/googleplay/android-developer/answer/9893335)
- [Class Mode privacy policy](https://classmode.inmodel.in/privacy)

## Product posture

- No advertising SDK, ad identifier use, sale of data, or behavioral advertising is intended.
- Production API traffic uses HTTPS. Access and refresh tokens are stored with Expo SecureStore.
- Role and school scoping are enforced by the server; the mobile app does not treat hidden UI as
  authorization.
- Push permission and push-token registration are optional. Core attendance and fee views continue
  when permission is denied.
- Android backup is disabled because the app handles school and child-related records.

## Candidate Play declarations

Confirm each row against actual production behavior. "Collected" includes data sent off device,
even when it is already held by the school.

| Play category | Examples in Class Mode | Collected | Required | Purpose |
| --- | --- | --- | --- | --- |
| Personal info | Name, email, phone number | Yes | Account/role dependent | Account management, app functionality |
| User IDs | Class Mode user, school, student IDs | Yes | Yes | Account management, tenant authorization |
| Financial info | Fee dues, paid amounts, payment history | Yes | Role dependent | School fee administration |
| App activity | Attendance marks and school workflow actions | Yes | Role dependent | App functionality, auditability |
| Other user-generated content | Parent child-claim code | Yes | Parent linking only | App functionality |
| Device or other IDs | Expo push token and platform | Optional | No | Push notifications |

Re-check whether server logs, hosting, error reporting, Expo push delivery, email, or any other SDK
introduces diagnostics, IP-derived data, or additional processor flows. A processor acting only on
Class Mode's instructions may not count as "sharing" under Play's definition, but that conclusion
depends on the real contract and use.

## Play Console checklist

- [ ] Declare the real target audience. Do not select children merely because records concern
      children; select child age groups only if children are intended app users.
- [ ] If any child age group is selected, complete the Families self-assessment and verify every
      API/SDK, content surface, social feature, and data practice against the current policy.
- [ ] Complete Data safety for every collected data type and all purposes.
- [ ] Confirm whether each type is required or optional for every user and region.
- [ ] Confirm encryption in transit from a production packet/config review.
- [ ] Provide the public privacy-policy URL in Play Console and in the app/store listing.
- [ ] Review the generated manifest for permissions, including notifications and biometrics.
- [ ] Complete content rating, app access, ads declaration, and target audience/content forms.
- [ ] Provide a deletion request path if Play requires one for the final account model.
- [ ] Use synthetic reviewer data and private reviewer credentials; never expose real student data.

## DPDP readiness

The product handles personal data relating to children in India. Before expanding beyond a named
pilot, obtain counsel or an accountable privacy owner to verify the then-current Digital Personal
Data Protection Act and Rules. At minimum, document:

- [ ] The school/Class Mode roles for each data flow and each processor.
- [ ] Clear notice at or before collection, including purpose and contact/grievance route.
- [ ] The lawful basis and verifiable parent/guardian consent flow where required.
- [ ] How a parent or authorized user can access, correct, export, and erase data.
- [ ] Retention periods and deletion propagation across backups and processors.
- [ ] A breach-response and user/regulator notification procedure.
- [ ] A ban on tracking, behavioral monitoring, targeted advertising, and sale of children's data.
- [ ] Processor agreements and cross-border processing review.
- [ ] Evidence that `/api/gdpr/export` and `/api/gdpr/delete` are authorized, complete, and safe for
      linked parent/child and school-retention obligations.

## Apple follow-up

Before TestFlight/App Store distribution, repeat the data inventory for Apple's privacy nutrition
labels, confirm export-compliance answers, and add App Store review/privacy metadata. Android-first
pilot approval does not prove the Apple declarations.
