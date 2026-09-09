# StudyDesk — First Review To-do and Acceptance Plan

This checklist turns the first review into testable product work. Database changes stay consolidated in the pending Supabase migration so they can be applied once after the app changes are approved.

## 1. Typography readability

- [x] Darken muted text while preserving the neutral palette.
- [x] Increase small labels, table text, helper text, navigation, and card notes on desktop and mobile.
- [x] Keep long names, phone numbers, dates, and amounts from overflowing.

Acceptance test:

1. Open Overview, Members, Fees, Settings, and every member/payment modal on desktop and mobile.
2. Confirm ordinary text is comfortable to read without zooming and secondary text still looks secondary.
3. Increase browser text size to 200% and confirm important controls and values remain usable.

## 2. Membership dates and duration

- [x] Let an administrator edit a member's membership start date and current plan duration.
- [x] Let fee collection specify the payment date, membership-period start, and duration.
- [x] Store the covered period on each new payment so later edits do not rewrite history.
- [x] Handle expired memberships, future renewals, backdated payments, and first payments consistently.

Acceptance test:

1. Edit a member and change the start date and duration; confirm the valid-until date updates.
2. Collect a fee for an expired member; confirm the suggested period starts today but remains editable.
3. Collect early for an active member; confirm the suggested period starts at the current expiry and extends from there.
4. Use a backdated payment date with a different membership-period start; confirm both dates are shown correctly in Fees.

## 3. Advance admission without immediate payment

- [x] Keep recording payment selected by default for advance-fee libraries.
- [x] Allow it to be deselected.
- [x] Show an in-app warning before admitting the member without payment.
- [x] Mark the member as unpaid/due until the first fee is recorded.

Acceptance test:

1. In an advance-fee library, add a member with payment and confirm both records are created.
2. Add another member without payment; confirm the warning appears and cancellation preserves the form.
3. Confirm acceptance creates the member but no payment.
4. Open that member and collect the first payment with editable period dates and duration.

## 4. Original StudyDesk identity

- [x] Create an original SD monogram with a clear small-size silhouette.
- [x] Add it to the sidebar, authentication brand, and installable-app icons.
- [x] Preserve a text fallback and accessible alternative text.

Acceptance test:

1. Check the mark at desktop sidebar size and on mobile authentication.
2. Confirm it stays crisp, does not distort, and the brand remains readable if the image fails.

## 5. Fees archive and long-term reporting

- [x] Show all-time collection, filtered collection, payment count, and monthly average.
- [x] Add useful presets: this month, last month, this year, and all time.
- [x] Add a custom date range with validation.
- [x] Add calendar-year filters and CSV export for year-end reporting.
- [x] Group archive records by month and show monthly totals.
- [x] Keep member name and seat snapshots understandable after member deactivation or seat changes.
- [x] Make the archive usable after multiple years without putting every transaction in the first viewport.

Acceptance test:

1. Switch each preset and compare totals with the visible payments.
2. Select a custom date range crossing two calendar years.
3. Try an end date before the start date and confirm a helpful validation message.
4. Confirm months with no payments are omitted and the no-results state is clear.
5. Confirm a deactivated member's old payments remain visible.

## 6. Member identity and lifecycle

- [x] Treat the normalized phone number as the unique member identity within a library while allowing name corrections.
- [x] Block a second active record for the same person.
- [x] Offer to reactivate a matching deactivated member with a new seat, shift, fee, and plan.
- [x] Rename removal to deactivation and preserve all history.
- [x] Add Active, Deactivated, and All filters to the Members page.

Acceptance test:

1. Try adding the same phone with either the same or a different name; confirm the duplicate is identified and the active member's seat is shown.
2. Deactivate the member and confirm their seat becomes available while fees remain.
3. Show Deactivated members, open the profile, and reactivate with a different seat.
4. Confirm only one record exists for that identity and the prior payment archive remains attached.

## 7. Demo seats and payment safeguards

- [x] Let an admin start or stop a persistent demo on an available seat for the selected shift.
- [x] Treat demo seats as unavailable in overlapping shifts and clear the demo when admitting a member there.
- [x] Show every member's fee history, count, and collected total from the profile.
- [x] Warn before recording or correcting a payment whose covered period overlaps another payment for that member.
- [x] Permit older payment corrections with an explicit review step while keeping the deletion window limited.
- [x] Restrict admin removal to the Core admin in both the interface and database.

Acceptance test:

1. Start a demo in one shift, reload, and confirm every admin sees the teal demo seat.
2. Open an overlapping shift and confirm the same physical seat is unavailable there.
3. Admit a member into the demo seat and confirm the demo state clears.
4. Open a member profile and verify fee count, total, history, and edit actions.
5. Add an overlapping covered period and confirm the warning names the existing payment.
6. Edit an older payment and confirm the extra review appears before saving.
7. Confirm a regular admin cannot remove another admin, including through a direct database request.

## 8. Overview tiles

- [x] Give each tile a light status colour with a darker border.
- [x] Restore the icons on mobile.
- [x] Keep text contrast and spacing consistent with the neutral design.

Acceptance test:

1. Compare all four tiles on desktop and mobile.
2. Confirm each icon is visible and each colour remains readable in bright and dim screens.
3. Confirm long currency values do not overflow.

## 9. Shift presets

- [x] Replace free-form names with Morning, Afternoon, Evening, Full Day, and Hour presets.
- [x] Permit one of each named day-part but multiple Hour shifts.
- [x] Number hourly shifts automatically and show their time in brackets.
- [x] Preserve existing member assignments when a shift is renamed by a timing change.
- [x] Continue enforcing overlapping-seat conflicts.

Acceptance test:

1. Add Morning, Afternoon, Evening, and Full Day; confirm duplicates are rejected.
2. Add several Hour shifts and confirm labels such as `Hour 1 (08:00–09:00)` remain unique.
3. Change an Hour time and confirm assigned members follow the renamed shift.
4. Confirm a Full Day member blocks the same seat in all overlapping shifts.

## 10. Optional attendance

- [x] Make attendance disabled by default.
- [x] Hide it from navigation when disabled without deleting historical records.
- [x] Add an Enable attendance option in Settings.
- [x] Keep the data model ready for a future camera/AI-assisted workflow.

Acceptance test:

1. Confirm Attendance is absent by default.
2. Enable it in Settings and confirm the navigation item and existing records appear.
3. Disable it again and confirm records are preserved when re-enabled.

## Final regression

- [ ] Apply the combined Supabase migration once.
- [ ] Verify owner and invited-admin access.
- [ ] Verify install-as-app behavior.
- [x] Verify production build.
- [ ] Verify mobile/desktop navigation with the owner.
- [ ] Recheck member/demo seat conflicts, payment overlap warnings and corrections, backups, and logout confirmation.
