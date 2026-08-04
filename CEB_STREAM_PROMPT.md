# Mai Troll — Celeb Stream, Verification, Monetization, and Cashout System

Implement a complete **Celeb Stream** system in Mai Troll for verified celebrities, performers, artists, public figures, influencers, entertainers, athletes, creators, and other approved notable users.

This must integrate into the current Mai Troll authentication, profiles, ViewerPage, BroadcastPage, SetupPage, wallet, gifts, chat, battles, moderation, notifications, cashout, RTCAdminMonitor, and admin systems.

Do not build a separate platform or separate wallet. Celeb accounts remain Mai Troll accounts but receive a verified celebrity role, specialized profile, specialized streaming tools, enhanced monetization, and separate cashout privileges.

Do not remove or rewrite existing regular-user functionality.

---

# 1. Celeb Account Role

Add a dedicated account type:

```txt
celeb
```

Recommended role states:

```txt
celeb_pending
celeb_under_review
celeb_more_info_required
celeb_approved
celeb_rejected
celeb_suspended
celeb_revoked
```

A user must not receive Celeb Stream access merely by selecting the Celeb signup option.

They must:

1. Create an account.
2. Select Celeb Signup.
3. Complete their basic profile.
4. Submit identity verification.
5. Submit proof of public identity or celebrity status.
6. Accept the Celeb Terms.
7. Wait for approval.
8. Receive approval from an authorized CEO or admin reviewer.
9. Complete the Celeb SetupPage.

Only approved Celeb accounts may access Celeb Stream tools.

---

# 2. Celeb Signup at Authentication

Add a new option to the authentication page:

```txt
Sign Up as a Celeb
```

The normal signup options should remain available.

Celeb signup should include:

* Legal first name
* Legal last name
* Public or stage name
* Username
* Email
* Phone number when required
* Password
* Date of birth
* Country
* Public profession or category
* Official website
* Primary social profile
* Additional social profiles
* Management or agency name, when applicable
* Manager or representative contact, when applicable
* Short explanation of why the user qualifies
* Identity verification
* Celebrity-status proof
* Celeb Terms acceptance
* Privacy acknowledgment

Possible Celeb categories:

* Music artist
* Actor
* Comedian
* Athlete
* Influencer
* Public figure
* Content creator
* Reality personality
* Model
* Performer
* Author
* Journalist
* Business personality
* Political or civic personality
* Other approved public figure

Do not expose legal names publicly unless the approved user chooses to display them.

---

# 3. Identity Verification

Celeb applicants must complete identity verification.

Use a secure identity-verification provider or a secure server-side document workflow.

Supported evidence may include:

* Government-issued photo ID
* Passport
* Driver's license
* State identification card
* Live selfie or liveness check
* Face match
* Date-of-birth verification
* Name match

The applicant must also submit proof connecting their legal identity to their public identity.

Examples:

* Official website
* Verified social media profile
* Agency page
* Artist profile
* News article
* Public event listing
* IMDb or similar professional listing
* Sports organization profile
* Music platform profile
* Government or organizational profile
* Management confirmation
* Publicly verifiable business page

Identity verification and celebrity-status verification are separate requirements.

A valid ID alone must not automatically prove celebrity status.

---

# 4. Secure ID Handling

Do not store raw identity documents in public storage.

Use:

* Private storage buckets
* Signed, expiring URLs
* Server-side authorization
* Encryption at rest
* Restricted reviewer access
* Access logs
* Download prevention where possible
* Automatic expiration
* Document-retention rules
* Secure deletion after the required review period

Only authorized CEO or designated verification admins may view submitted identity documents.

Normal admins, moderators, broadcasters, viewers, and support users must not access identity documents.

RTCAdminMonitor should display the identity verification inside a protected review screen.

Do not place direct permanent document URLs in frontend records.

Do not send ID images through public realtime payloads.

Realtime notifications should include only the application ID and review status.

---

# 5. Instant RTCAdminMonitor Notification

When a Celeb application is submitted, immediately notify RTCAdminMonitor.

The notification should contain:

* Applicant username
* Public or stage name
* Celeb category
* Submission time
* Application ID
* Verification status
* Proof status
* Risk flags
* Review button

Example notification:

```txt
New Celeb Verification Submitted

@username submitted a Celeb account application.
Stage Name: Example Artist
Category: Music Artist
Status: Ready for Review
```

Add:

* Sound notification
* Visual notification badge
* Desktop notification when permission is granted
* Unread verification count
* Priority queue
* Open review button

Use a dedicated Celeb Verification section inside RTCAdminMonitor.

---

# 6. RTCAdminMonitor Celeb Verification Dashboard

Add a Celeb Verification dashboard with tabs:

* New
* Under review
* More information required
* Approved
* Rejected
* Suspended
* Revoked
* High risk

Each application should display:

* Username
* Legal name
* Stage or public name
* Date of birth
* Email
* Phone, when collected
* Country
* Celeb category
* Biography
* Official website
* Social links
* Agency or manager details
* Identity-verification result
* Liveness result
* Name-match result
* Submitted ID preview
* Celebrity-status evidence
* Uploaded supporting files
* Application history
* Risk flags
* Duplicate-account matches
* Previous applications
* Reviewer notes
* Decision history

Authorized reviewers must be able to:

* Approve
* Reject
* Request more information
* Place under review
* Suspend
* Revoke Celeb status
* Add internal notes
* Add rejection reason
* Add approval conditions
* Escalate for CEO review
* View access logs
* View document-verification results

Approval should require a confirmation modal.

Example:

```txt
Approve @username as a verified Mai Troll Celeb?

This will enable Celeb Stream, Celeb monetization, Celeb profile styling, paid chat, product links, and Celeb cashouts.
```

---

# 7. Celeb Approval Behavior

When approved:

1. Update the account role to `celeb_approved`.
2. Create or update the Celeb profile record.
3. Add the verified Celeb badge.
4. Enable Celeb SetupPage.
5. Enable Celeb Stream.
6. Enable Celeb profile customization.
7. Enable paid chat.
8. Enable external product and merchandise links.
9. Enable Celeb cashout rules.
10. Notify the user.
11. Record the reviewer and approval time.
12. Record a complete audit event.

Send the approved user a notification:

```txt
Your Mai Troll Celeb account has been approved.

You can now complete your Celeb profile, host Celeb Streams, enable paid chat, promote approved external links, and use Celeb cashout options.
```

If more information is requested, the user should be able to upload the requested evidence without creating a new account.

---

# 8. Verified Celeb Profile

Approved Celeb accounts must have a visibly different profile from regular users.

Add:

* Verified Celeb badge
* Gold or premium profile border
* Celeb label
* Public or stage name
* Celeb category
* Short biography
* Official website
* Verified social links
* Management or booking information
* Upcoming events
* Featured content
* Merchandise links
* Current live status
* Upcoming live schedule
* Follower count
* Total stream views
* Total performances
* Top supporter section
* Celeb milestones
* Optional charity or cause section
* Featured clips
* Paid-chat status
* Public appearances or tour dates

Do not expose:

* Government ID
* Legal address
* Private phone number
* Private legal name unless authorized
* Identity-verification documents
* Internal review notes
* Risk flags

The public profile should clearly distinguish:

* Mai Troll verified Celeb account
* User-submitted external links
* Mai Troll-hosted purchases
* Off-platform purchases

---

# 9. Celeb SetupPage

When a Celeb user opens SetupPage, detect their approved role and display the Celeb version.

The Celeb SetupPage should include:

## Stream Details

* Stream title
* Stream description
* Category
* Performance type
* Scheduled or immediate stream
* Thumbnail
* Background image
* Stream theme
* Age rating
* Language
* Public or followers-only stream
* Chat enabled
* Paid chat enabled
* Gifts enabled
* Battles enabled
* Random battle queue enabled
* Replay enabled
* Clips enabled
* External links enabled
* Merchandise panel enabled
* Donations or supporter goals when permitted
* Announcements
* Content warnings

## Performance Types

* Live performance
* Concert
* Music session
* Interview
* Question and answer
* Meet and greet
* Comedy
* Podcast
* Product launch
* Viewing party
* Fan event
* Charity event
* Behind the scenes
* Announcement
* General Celeb live

## Preview

Allow the Celeb to preview:

* Video
* Microphone
* Stream title
* Thumbnail
* Paid-chat price
* Merchandise panel
* External links
* Chat settings
* Battle availability
* Moderation controls
* Goal widget
* Performance overlays

---

# 10. Celeb Stream Rules

Celeb Stream must be a dedicated stream type:

```txt
celeb_stream
```

Celeb Stream rules:

* No guest seats
* No seat requests
* No seat invitations
* No seat purchases
* No seat queue
* No co-host seats
* No user-added boxes
* No viewer video participation
* Celeb remains the only live host
* Chat remains available
* Gifts remain available
* Paid chat may be enabled
* Battles may be enabled
* Random battle queue may be enabled
* Moderation controls remain available
* Performance mode is supported
* Scheduled streams are supported
* External product links are supported

Remove or hide all seat-related controls on Celeb Stream ViewerPage and Celeb BroadcastPage.

Do not merely disable the seat button visually. Backend seat-join functions must reject Celeb Stream IDs.

Example server response:

```txt
Guest seats are not available in Celeb Streams.
```

---

# 11. Celeb BroadcastPage

Celeb BroadcastPage should use the existing BroadcastPage chat and core broadcasting logic, but add Celeb-specific tools.

Include:

* Live video controls
* Microphone controls
* Camera controls
* Stream health
* Viewer count
* Gift total
* Paid-chat total
* Coin earnings
* Follower growth
* Active supporter goal
* Current battle
* Random battle queue
* Product panel
* Link panel
* Moderation panel
* Pinned messages
* Announcements
* Performance overlays
* Stream schedule
* End stream button
* Emergency stream lock
* Replay settings
* Clip permissions

Do not show seat controls.

---

# 12. Celeb Mod Powers

Celebs should receive broadcaster moderation powers inside their own streams.

Allow them to:

* Mute a viewer from chat
* Unmute a viewer
* Remove a viewer from the stream
* Ban a viewer from their streams
* Unban a viewer
* Delete chat messages
* Clear chat
* Enable slow mode
* Enable follower-only chat
* Enable verified-only chat
* Disable free chat
* Pause paid chat
* Pin messages
* Unpin messages
* Appoint temporary stream moderators
* Remove temporary stream moderators
* Disable gifts
* Disable external links
* Lock the stream
* End a battle
* Leave the random battle queue
* Report a user to Mai Troll staff

Celebs may moderate only their own streams.

They must not receive CEO, admin, platform-wide moderator, wallet-editing, verification, or account-management powers.

All Celeb moderation actions must be logged.

---

# 13. Random Battle Queue

Add a Random Battle Queue button to Celeb BroadcastPage.

Celebs may choose:

```txt
Join Random Celeb Battle Queue
```

Random battle matchmaking should support:

* Celeb versus Celeb
* Optional Celeb versus approved broadcaster
* Category matching
* Language matching
* Audience-size matching
* Region matching when desired
* Explicit content compatibility
* Battle cooldown
* Blocklist enforcement
* Previous opponent cooldown
* Manual accept before battle starts

Do not instantly connect two broadcasters without confirmation.

Flow:

1. Celeb joins the queue.
2. Backend finds a compatible opponent.
3. Both users receive a battle offer.
4. Both users must accept.
5. The battle room is created.
6. Viewer audiences are notified.
7. Battle timer begins.
8. Gifts count toward the selected team.
9. The battle ends.
10. Results and earnings are recorded.

No guest seats may appear during Celeb battles.

Celeb battle formats may include:

* Three-minute battle
* Five-minute battle
* Performance battle
* Music battle
* Comedy battle
* Fan-choice battle
* Charity battle
* Promotional battle

Add the ability to:

* Leave queue
* Pause queue
* Decline match
* Block future matchups
* Report opponent
* Disable battles entirely

---

# 14. Paid Chat

Approved Celebs may enable paid chat.

Paid chat allows viewers to pay coins to send highlighted messages.

Support two pricing modes:

## Fixed Price Per Message

The Celeb chooses an approved price tier.

Example tiers:

```txt
50 coins
100 coins
250 coins
500 coins
1,000 coins
2,500 coins
5,000 coins
```

## Viewer-Selected Amount

The viewer chooses how many coins to attach to the message, subject to minimum and maximum limits.

Paid chat features:

* Highlighted message
* Priority placement
* Optional text-to-speech
* Pinned duration based on amount
* Celeb can answer or acknowledge
* Viewer profile shown
* Amount shown
* Paid-chat leaderboard
* Paid-chat history
* Refund handling
* Moderation filters
* Rate limits

Paid chat must not bypass:

* Blocked-word filters
* Harassment filters
* Threat detection
* Spam detection
* User bans
* Chat cooldown
* Stream restrictions

Paying for a message does not guarantee:

* A response
* A follow
* A personal meeting
* A service
* A product
* A refund
* Special treatment

Display that disclosure before purchase.

---

# 15. Paid Chat Earnings

Paid-chat transactions must use the current Mai Troll wallet and earnings systems.

Track separately:

* Viewer amount paid
* Platform fee
* Celeb gross earnings
* Celeb net earnings
* Refund amount
* Cashable amount
* Non-cashable amount
* Tax-reporting category when applicable

Do not create duplicate money from a highlighted message.

Use server-side pricing and transaction functions.

Prevent:

* Duplicate charges
* Replayed requests
* Client-edited prices
* Negative balances
* Self-paid chat
* Staff test-account cashable earnings
* Paid-chat farming
* Refund abuse

---

# 16. Celeb Product and Merchandise Panel

Approved Celebs may add items they sell outside Mai Troll.

Allow Celebs to add:

* Item name
* Item description
* Product image
* Price display
* Currency
* External purchase URL
* Store name
* Product category
* Availability
* Shipping regions
* Promotional text
* Start date
* End date
* Featured-item status

Possible categories:

* Merchandise
* Music
* Tickets
* Books
* Clothing
* Autographs
* Event access
* Memberships
* Digital products
* Fan experiences
* Official store
* Charity products
* Other approved products

These items should appear:

* On the Celeb profile
* On Celeb ViewerPage
* In a stream merchandise drawer
* In pinned product cards
* During approved promotional moments

---

# 17. External Link Support

Mai Troll currently lacks external-link support. Add a secure external-link system.

Allow only approved Celeb accounts to publish external promotional links unless broader link support is later enabled.

External links should support:

* HTTPS only
* Link-title preview
* Domain display
* External-link icon
* Confirmation screen
* Open in a new tab
* `noopener`
* `noreferrer`
* URL validation
* Malware and phishing screening
* Blocked-domain list
* Allowlist for trusted platforms
* Link expiration
* Admin removal
* User reporting
* Audit history

Do not allow:

* JavaScript URLs
* Data URLs
* Localhost URLs
* Private IP addresses
* Executable downloads
* Known malware
* Phishing domains
* URL shorteners when the final destination cannot be inspected
* Credential-stealing pages
* Illegal-product pages
* Impersonation pages

Display a warning before opening:

```txt
You are leaving Mai Troll.

This link is operated by a third party. Mai Troll does not own, control, fulfill, guarantee, or process purchases made through this external website.
```

Add a checkbox or button:

```txt
Continue to External Site
```

---

# 18. External-Link Disclaimer

Display a clear disclaimer on Celeb product cards and external links:

```txt
External Link

This product, service, event, or website is offered by the Celeb or another third party. Mai Troll does not own, sell, ship, fulfill, process, endorse, guarantee, insure, refund, or provide customer service for purchases completed outside Mai Troll.

Any payment, order, subscription, delivery, refund, dispute, warranty, privacy issue, or customer-service request must be handled directly with the external seller.
```

Do not use wording that falsely removes responsibilities that cannot legally be waived.

The platform terms should be reviewed by qualified legal counsel before production release.

---

# 19. Product Promotion During Streams

Celebs should be able to:

* Pin a product
* Unpin a product
* Display a product card
* Schedule product appearances
* Add product overlays
* Mention a product in announcements
* Track link clicks
* Track product-card views
* Track outbound conversions when supported
* Disable products during a stream

Viewers should be able to:

* Open the product drawer
* View product details
* Report a product
* Copy the external link
* Continue to the external site
* Close the product overlay

Product overlays must not cover:

* The Celeb's face
* Paid chat
* Emergency moderation alerts
* Battle scores
* Stream controls

---

# 20. Celeb Cashout System

Approved Celebs must receive a separate cashout policy from regular Mai Pay and Mai Pay Plus users.

Celebs should not be limited by normal daily cashout schedules.

Approved Celebs may request cashouts at any time, subject to:

* Available cashable balance
* Identity verification
* Account status
* Fraud review
* Chargeback reserve
* Tax or payout requirements
* Payment-provider availability
* Security holds
* Minimum cashout amount
* Maximum transaction limits
* Manual review thresholds

Do not allow pending, rejected, suspended, or revoked Celeb accounts to use Celeb cashout privileges.

---

# 21. Celeb Cashout Tiers

Create configurable Celeb cashout tiers beginning at:

```txt
100,000 coins = $600
```

Suggested Celeb tiers:

```txt
100,000 coins = $600
200,000 coins = $1,250
300,000 coins = $1,900
500,000 coins = $3,250
750,000 coins = $5,000
1,000,000 coins = $6,800
1,500,000 coins = $10,500
2,000,000 coins = $14,500
3,000,000 coins = $22,500
5,000,000 coins = $40,000
```

These values must be configurable from the CEO dashboard and must not be hardcoded throughout the frontend.

Before production deployment, verify that the coin-to-cash conversion, platform revenue, payment fees, refunds, chargebacks, taxes, broadcaster obligations, and cash reserves support each tier.

Do not activate a tier that would pay out more than the platform can safely fund.

---

# 22. Anytime Celeb Cashouts

Celeb cashouts should support:

* Request cashout at any time
* Multiple requests per day when approved
* Saved payout methods
* Payout-status tracking
* Estimated payout amount
* Fee breakdown
* Gross amount
* Net amount
* Security review status
* Manual-review status
* Payment-provider status
* Completed date
* Failed-payout retry

Possible statuses:

```txt
requested
identity_check
security_review
manual_review
approved
processing
paid
failed
canceled
reversed
held
```

"Any time" means the Celeb may submit a request at any time. It must not promise instant bank settlement when the payment provider, fraud review, banking network, or compliance process requires additional time.

---

# 23. Large Cashout Review

Require enhanced review for high-value Celeb cashouts.

Configurable review thresholds may include:

```txt
$600+
$2,500+
$5,000+
$10,000+
```

Review may require:

* Fresh identity confirmation
* Two-factor authentication
* Payout-method confirmation
* Tax form status
* Earnings-source review
* Chargeback review
* Account-security review
* Manual CEO approval
* Payment-provider limits

Never expose the full payout account number in RTCAdminMonitor.

Display only masked payout details.

---

# 24. Celeb Earnings Dashboard

Add a Celeb Earnings dashboard containing:

* Current coin balance
* Cashable coin balance
* Non-cashable coin balance
* Pending earnings
* Available cashout value
* Gift earnings
* Paid-chat earnings
* Battle earnings
* Subscription earnings when added
* Product-link clicks
* Stream-by-stream earnings
* Platform fees
* Refunds
* Chargebacks
* Security reserves
* Cashout history
* Tax documents
* Downloadable statements
* Revenue trends
* Top streams
* Top supporters
* Average earnings per viewer
* Paid-chat conversion rate

Clearly distinguish:

* Estimated earnings
* Pending earnings
* Available earnings
* Paid earnings
* Reversed earnings

---

# 25. Celeb Subscriptions

Add an optional Celeb subscription system.

Celebs may offer:

* Supporter badge
* Subscriber-only chat
* Subscriber-only streams
* Early stream access
* Exclusive profile posts
* Exclusive clips
* Custom chat badge
* Monthly supporter recognition
* Product discounts through external codes
* Presale links
* Subscriber polls

Subscription benefits must not promise illegal, deceptive, or unavailable services.

All prices and benefits must be shown before purchase.

---

# 26. Ticketed Celeb Streams

Allow approved Celebs to create optional ticketed streams.

Support:

* Free streams
* Coin-ticket streams
* Invite-only streams
* Subscriber-only streams
* Limited-capacity streams
* Replay access
* Early-entry windows
* Ticket-transfer rules
* Refund policies
* Cancellation handling

Ticket purchases must be validated server-side.

Do not allow a Celeb to privately change the ticket price after viewers have purchased access.

---

# 27. Scheduled Streams and Premieres

Celebs should be able to schedule streams.

Add:

* Schedule date
* Schedule time
* Time zone
* Countdown
* Reminder button
* Calendar export
* Follow reminder
* Push notification
* Email reminder when supported
* Reschedule notice
* Cancellation notice
* Premiere page
* Waiting room
* Pre-stream chat
* Product previews
* Paid-chat presales when allowed

Followers should receive notifications when:

* A Celeb schedules a stream
* A stream is starting soon
* A stream goes live
* A battle starts
* A stream is rescheduled
* A stream is canceled

---

# 28. Celeb Fan Club

Add a Celeb Fan Club section with:

* Top supporters
* Supporter levels
* Monthly leaders
* Lifetime leaders
* Paid-chat leaders
* Gift leaders
* Battle supporters
* Fan badges
* Loyalty points
* Exclusive announcements
* Subscriber benefits
* Fan polls

Celebs must not be able to manually edit supporter spending totals.

---

# 29. Celeb Stream Goals

Allow Celebs to configure stream goals:

* Coin goal
* Gift goal
* Paid-chat goal
* Viewer goal
* Follower goal
* Product-click goal
* Charity goal
* Battle-win goal
* Performance milestone

Goals must clearly state whether they are:

* Personal earnings goals
* Engagement goals
* Charity goals
* Promotional goals

Do not represent a personal goal as a charitable fundraiser.

---

# 30. Charity Streams

Allow approved Celebs to mark a stream as a charity stream only after additional review.

Require:

* Charity name
* Charity registration information where applicable
* Official charity link
* Fund-distribution explanation
* Donation processor
* Platform fee disclosure
* Recipient disclosure
* Start and end date
* Admin approval

Do not treat ordinary gifts as tax-deductible donations unless legally structured that way.

---

# 31. Celeb Replay and Clips

Allow Celebs to control:

* Replay enabled
* Replay disabled
* Clips enabled
* Clips disabled
* Clip duration
* Viewer-created clips
* Celeb-only clips
* Watermark
* Download permissions
* External sharing
* Music-rights warning
* Expiration date
* Paid replay access

Celebs should be able to remove clips from their own streams, but platform staff must retain moderation and evidence controls where legally required.

---

# 32. Music and Performance Tools

Add performance-friendly controls:

* High-quality audio mode
* Music mode
* Noise suppression toggle
* Echo cancellation toggle
* Audio level meter
* Backing-track input
* Instrument input
* Performance countdown
* Lyrics or setlist private panel
* Scene changes
* Stage lighting overlays
* Audience reaction meter
* Applause animation
* Encore vote
* Song-request paid chat
* Performance timer

Do not automatically broadcast copyrighted backing tracks supplied by Mai Troll.

The Celeb remains responsible for rights to content they stream, subject to Mai Troll's policies and applicable law.

---

# 33. Celeb Safety Tools

Add:

* Emergency chat lock
* Emergency stream privacy
* Mass mute
* Phrase blocking
* Link blocking
* Follower-only mode
* Subscriber-only mode
* Account-age restrictions
* Verified-viewer-only mode
* Paid-chat pause
* Gift pause
* Battle pause
* Panic button to alert RTCAdminMonitor
* Security contact button
* Harassment reporting
* Threat escalation

A Celeb panic alert should appear immediately in RTCAdminMonitor with the stream ID and account ID.

---

# 34. Impersonation Protection

Add protection against fake Celeb accounts.

Regular users must not be able to:

* Use the verified Celeb badge
* Use protected Celeb role labels
* Copy protected profile styling
* Claim approved Celeb status
* Use another Celeb's exact public identity deceptively

Add:

* Impersonation reports
* Protected-name review
* Duplicate-profile detection
* Badge verification endpoint
* Public verification status
* Revocation support
* Username-history review

Do not block legitimate fan, parody, commentary, or similarly named accounts unless they violate platform rules.

---

# 35. Database Structure

Inspect the current Mai Troll schema before creating any migration.

Reuse current tables when equivalent structures already exist.

Suggested tables:

## celeb_applications

```txt
id
user_id
public_name
legal_first_name
legal_last_name
date_of_birth
category
bio
website_url
agency_name
manager_name
manager_email
application_status
identity_status
celebrity_proof_status
risk_level
submitted_at
review_started_at
reviewed_at
reviewed_by
decision_reason
internal_notes
created_at
updated_at
```

## celeb_verification_documents

```txt
id
application_id
user_id
document_type
private_storage_path
verification_provider
provider_reference_id
verification_status
expires_at
uploaded_at
reviewed_at
deleted_at
metadata
```

## celeb_evidence

```txt
id
application_id
evidence_type
evidence_url
private_storage_path
description
verification_status
reviewer_notes
created_at
updated_at
```

## celeb_profiles

```txt
id
user_id
public_name
category
bio
official_website
booking_contact
management_name
verified_at
verified_by
verification_status
badge_status
paid_chat_enabled
external_links_enabled
random_battles_enabled
subscriptions_enabled
ticketed_streams_enabled
created_at
updated_at
```

## celeb_external_links

```txt
id
celeb_user_id
link_type
title
description
destination_url
domain
image_url
status
risk_status
starts_at
ends_at
approved_at
approved_by
created_at
updated_at
```

## celeb_products

```txt
id
celeb_user_id
name
description
image_url
display_price
currency
external_link_id
category
availability_status
is_featured
starts_at
ends_at
created_at
updated_at
```

## celeb_paid_chat_settings

```txt
id
celeb_user_id
stream_id
pricing_mode
fixed_price
minimum_price
maximum_price
text_to_speech_enabled
paid_chat_enabled
created_at
updated_at
```

## celeb_paid_chat_messages

```txt
id
stream_id
sender_user_id
celeb_user_id
message
coin_amount
platform_fee
celeb_earnings
status
moderation_status
transaction_id
created_at
updated_at
```

## celeb_cashout_tiers

```txt
id
coin_amount
cash_amount
currency
is_enabled
requires_manual_review
created_at
updated_at
```

## celeb_cashout_requests

```txt
id
celeb_user_id
coin_amount
gross_cash_amount
fees
net_cash_amount
payout_method_id
status
risk_status
requested_at
reviewed_at
reviewed_by
processed_at
completed_at
failure_reason
created_at
updated_at
```

Do not assume these exact columns already exist.

Do not create duplicate wallet, profile, stream, battle, or transaction tables when current equivalents exist.

---

# 36. Server Functions

Create or adapt secure backend functions for:

```txt
submit_celeb_application
upload_celeb_verification_document
submit_celeb_evidence
get_celeb_application
list_celeb_applications_for_review
start_celeb_review
request_celeb_more_information
approve_celeb_application
reject_celeb_application
suspend_celeb_status
revoke_celeb_status
restore_celeb_status
get_celeb_profile
update_celeb_profile
create_celeb_stream
join_random_celeb_battle_queue
leave_random_celeb_battle_queue
accept_celeb_battle
decline_celeb_battle
send_paid_chat
update_paid_chat_settings
create_celeb_external_link
validate_celeb_external_link
create_celeb_product
pin_celeb_product
request_celeb_cashout
review_celeb_cashout
process_celeb_cashout
get_celeb_earnings_summary
```

All sensitive functions must:

1. Authenticate the user.
2. Verify the correct role.
3. Validate account status.
4. Validate ownership.
5. Validate prices server-side.
6. Validate balances server-side.
7. Use database transactions.
8. Use row locks where money is involved.
9. Use idempotency keys.
10. Create an audit log.
11. Return sanitized data.
12. Avoid exposing identity documents in general responses.

---

# 37. Row-Level Security

Add strict RLS policies.

Celeb applicants may:

* View their own application
* Update permitted application fields
* Upload their own evidence
* View their own application status

Celeb applicants may not:

* Approve themselves
* Change reviewer notes
* Change verification results
* Grant themselves Celeb status
* View other applications
* View other users' ID documents

Authorized reviewers may:

* View applications
* View protected evidence
* Make decisions
* Add internal notes

Public users may view only approved public Celeb profile information.

---

# 38. Realtime Events

Add realtime events for:

* Celeb application submitted
* Verification completed
* More information requested
* Application approved
* Application rejected
* Celeb suspended
* Celeb revoked
* Celeb goes live
* Celeb joins battle queue
* Battle match found
* Paid chat received
* Product pinned
* External link removed
* Cashout requested
* Cashout approved
* Cashout paid
* Emergency Celeb alert

Register every `postgres_changes` callback before calling `.subscribe()`.

Do not attach additional callbacks to a channel after it has already subscribed.

Use unique channel names where separate components require separate subscriptions.

---

# 39. RTCAdminMonitor Sections

Add these sections:

```txt
Celeb Verification
Celeb Live Streams
Celeb Paid Chat
Celeb External Links
Celeb Products
Celeb Cashouts
Celeb Safety Alerts
Celeb Audit Logs
```

RTCAdminMonitor should allow authorized staff to:

* Review applications
* Approve Celebs
* Monitor live Celeb Streams
* Enter a Celeb Stream as staff
* End a stream
* Disable paid chat
* Remove an external link
* Remove a product
* Suspend a Celeb account
* Hold a cashout
* Approve a cashout
* View risk signals
* Review reports
* Respond to emergency alerts

---

# 40. Audit Logs

Log:

* Application submission
* ID access
* Evidence access
* Approval
* Rejection
* Information request
* Suspension
* Revocation
* Restoration
* Profile update
* External-link creation
* External-link removal
* Product creation
* Paid-chat pricing change
* Paid-chat transaction
* Battle queue activity
* Cashout request
* Cashout review
* Cashout payment
* Moderation action
* Emergency alert

Identity-document access logs must include:

* Reviewer user ID
* Application ID
* Document ID
* Access time
* Reason
* Session information
* Action performed

---

# 41. Abuse and Fraud Prevention

Prevent:

* Fake Celeb approvals
* Client-controlled role changes
* Reused identity documents
* Duplicate applications
* Stolen identity submissions
* Celeb impersonation
* Self-paid chats
* Self-gifting
* Cashout farming
* Chargeback cycling
* Duplicate cashout requests
* Payout-account switching immediately before cashout
* Client-controlled cashout conversion
* Client-controlled paid-chat pricing
* Fake external domains
* Phishing links
* Fake merchandise
* Battle manipulation
* Automated paid-chat spam
* Reviewer abuse
* Unauthorized ID access

Add additional review when:

* The payout method changes
* A large cashout is requested
* Account login location changes significantly
* Multiple Celeb applications use the same ID
* The public identity cannot be verified
* Paid-chat volume changes unexpectedly
* A large amount of coins arrives from a small number of accounts
* Chargebacks or refund disputes increase

---

# 42. UI Design

Use the current Mai Troll visual theme.

Celeb styling may include:

* Gold verified badge
* Premium profile border
* Animated Celeb live indicator
* Stage-style overlays
* Gold and dark premium accents
* Verified profile header
* Dedicated product carousel
* Paid-chat highlight colors
* Performance-mode controls

Do not make the interface look disconnected from Mai Troll.

Maintain:

* Mobile responsiveness
* Desktop responsiveness
* Accessibility
* Keyboard navigation
* Screen-reader labels
* Reduced-motion support
* Loading states
* Empty states
* Error states
* Retry states

---

# 43. Required Tests

Test:

1. Regular user attempts Celeb Stream access.
2. Pending Celeb attempts Celeb Stream access.
3. Approved Celeb starts a stream.
4. Seat request against Celeb Stream.
5. Celeb enables random battle queue.
6. Celeb accepts a battle.
7. Celeb declines a battle.
8. Celeb moderates their own chat.
9. Celeb attempts platform-wide moderation.
10. User sends paid chat.
11. User lacks enough coins for paid chat.
12. Duplicate paid-chat request.
13. Self-paid-chat attempt.
14. Celeb adds a valid HTTPS link.
15. Celeb adds a dangerous or invalid link.
16. Viewer opens an external link.
17. Product is pinned during a stream.
18. Celeb requests a 100,000-coin cashout.
19. Pending Celeb attempts Celeb cashout.
20. Suspended Celeb attempts Celeb cashout.
21. Duplicate cashout submission.
22. Large cashout triggers review.
23. RTCAdminMonitor receives the application instantly.
24. Authorized reviewer views submitted ID.
25. Unauthorized admin attempts to view ID.
26. Applicant approval changes the profile.
27. Rejection does not grant Celeb permissions.
28. More-information request reopens applicant upload.
29. Page refresh preserves Celeb stream state.
30. Stream ending removes battle queue status.
31. Realtime listeners are attached before subscribe.
32. Raw ID URLs never appear in public responses.
33. External links show the third-party disclaimer.
34. Celeb profile displays usernames instead of UUIDs.
35. Cashable and non-cashable coins remain separated.

---

# 44. Implementation Restrictions

* Inspect the current Mai Troll codebase and schema first.
* Reuse existing authentication.
* Reuse the current wallet.
* Reuse current gifts and transaction systems.
* Reuse the current BroadcastPage chat.
* Reuse current battles where possible.
* Reuse RTCAdminMonitor.
* Do not create a second coin balance.
* Do not create a separate cashout platform.
* Do not give Celebs unrestricted admin access.
* Do not allow seat access in Celeb Streams.
* Do not expose identity documents publicly.
* Do not store service-role credentials in the frontend.
* Do not trust frontend prices.
* Do not trust frontend roles.
* Do not trust frontend payout values.
* Do not hardcode database columns without inspecting the schema.
* Do not rewrite unrelated pages.
* Do not use mock data in production.
* Do not break normal broadcasts.
* Do not break ViewerPage.
* Do not break regular Mai Pay cashouts.
* Do not promise that external purchases are handled by Mai Troll.
* Do not claim that all legal liability can be waived by a disclaimer.

Complete the feature using production-ready frontend components, server functions, RLS policies, private storage, realtime notifications, role checks, transaction safety, audit logs, and automated tests.