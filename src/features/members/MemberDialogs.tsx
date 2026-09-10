import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ConfirmDialog, Modal, ModalHeader } from "../../components/ui/Modal";
import { PhoneLink } from "../../components/ui/PhoneLink";
import { StatusPill } from "../../components/ui/StatusPill";
import { statusSurfaceStyles } from "../../components/workspace/memberStatusStyles";
import { PAYMENT_EDIT_REVIEW_DAYS } from "../../config/constants";
import type {
  Member,
  ModalState,
  Payment,
  PaymentMode,
  WorkspaceCommit,
  WorkspaceData,
} from "../../types/domain";
import {
  addMonths,
  daysSince,
  daysUntil,
  localDate,
  money,
  monthsBetween,
  prettyDate,
  uid,
} from "../../utils/format";
import {
  currentPaymentForMember,
  findMemberByPhone,
  findOverlappingPayment,
  memberStatus,
  normalizeMemberPhone,
} from "../../utils/members";
import { defaultFeeForSeat, seatCodes } from "../../utils/seats";
import {
  configuredShifts,
  demoOccupiesShift,
  shiftTiming,
  shiftsOverlap,
} from "../../utils/shifts";

const DURATION_OPTIONS = [1, 2, 3, 6, 12];
const CUSTOM_DURATION = "custom";
const PAYMENT_MODES: PaymentMode[] = ["UPI", "Cash", "Card", "Bank transfer"];
type Values = Record<string, string>;
const valuesFrom = (form: HTMLFormElement): Values =>
  Object.fromEntries(
    [...new FormData(form)].map(([key, value]) => [key, String(value)]),
  );

function DurationOptions() {
  return (
    <>
      {DURATION_OPTIONS.map((months) => (
        <option key={months} value={months}>
          {months} {months === 1 ? "month" : "months"}
        </option>
      ))}
      <option value={CUSTOM_DURATION}>Custom end date</option>
    </>
  );
}
function PaymentModeOptions() {
  return (
    <>
      {PAYMENT_MODES.map((mode) => (
        <option key={mode} value={mode}>
          {mode}
        </option>
      ))}
    </>
  );
}

function PaymentAmountSummary({
  monthlyFee,
  months,
}: {
  monthlyFee: number;
  months: number;
}) {
  const safeMonths = Math.max(1, months || 1);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <small className="block font-bold text-slate-600">Payment amount</small>
      <strong className="mt-1 block text-xl text-slate-900">
        {money(monthlyFee * safeMonths)}
      </strong>
      <small className="text-slate-500">
        {money(monthlyFee)} × {safeMonths}{" "}
        {safeMonths === 1 ? "month" : "months"}
      </small>
    </div>
  );
}

const endForDuration = (start: string, duration: string, customEnd?: string) =>
  duration === CUSTOM_DURATION
    ? customEnd || start
    : addMonths(start, Number(duration) || 1);

const monthsForStorage = (
  start: string,
  duration: string,
  customEnd?: string,
) =>
  duration === CUSTOM_DURATION
    ? monthsBetween(start, customEnd) || 1
    : Number(duration) || 1;

const durationSelection = (start: string, end: string, months?: number) => {
  const storedMonths = months || monthsBetween(start, end);
  return addMonths(start, storedMonths) === end
    ? String(storedMonths)
    : CUSTOM_DURATION;
};

function paymentFrom(member: Member, values: Values): Payment {
  const periodStart = values.periodStart || values.start;
  const periodEnd = endForDuration(
    periodStart,
    values.months,
    values.periodEnd,
  );
  const periodMonths = monthsForStorage(periodStart, values.months, periodEnd);
  return {
    id: uid(),
    memberId: member.id,
    memberName: member.name,
    seat: member.seat,
    amount: Number(values.amount ?? member.fee * periodMonths),
    date: values.paymentDate ?? values.date,
    mode: (values.paymentMode ?? values.mode) as PaymentMode,
    periodStart,
    periodMonths,
    periodEnd,
  };
}

function updateCurrentPlan(member: Member, payment: Payment, force = false) {
  if (!force && member.expiry && payment.periodEnd < member.expiry) return;
  member.planStart = payment.periodStart;
  member.planMonths = payment.periodMonths;
  member.expiry = payment.periodEnd;
}

interface CommonProps {
  data: WorkspaceData;
  commit: WorkspaceCommit;
  close: () => void;
}

const demosForSeat = (data: WorkspaceData, seat: string, shift: string) =>
  data.demoSeats.filter(
    (demo) =>
      demo.seat === seat &&
      demoOccupiesShift(demo, shift, data.settings.shifts),
  );

function SeatActionsDialog({
  seat,
  selectedShift,
  data,
  commit,
  close,
  setModal,
}: CommonProps & {
  seat: string;
  selectedShift: string;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const [saving, setSaving] = useState(false);
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [error, setError] = useState("");
  const demos = demosForSeat(data, seat, selectedShift);
  const demo = demos[0];
  const member = data.members.find(
    (item) =>
      item.active &&
      item.seat === seat &&
      shiftsOverlap(data.settings.shifts, item.shift, selectedShift),
  );
  const selected = configuredShifts(data.settings).find(
    (item) => item.name === selectedShift,
  );
  const availableSeats = seatCodes(data.settings);
  const occupiedAt = (targetSeat: string) =>
    data.members.find(
      (item) =>
        item.active &&
        item.seat === targetSeat &&
        shiftsOverlap(data.settings.shifts, item.shift, selectedShift),
    );
  const demoAt = (targetSeat: string) =>
    data.demoSeats.find(
      (item) =>
        item.seat === targetSeat &&
        shiftsOverlap(data.settings.shifts, item.shift, selectedShift),
    );

  async function startDemo(values?: Values) {
    const targetSeat = values?.seat || seat;
    const name = values?.name?.trim();
    const phone = values?.phone?.trim();
    const occupied = occupiedAt(targetSeat);
    if (occupied) {
      setError(`${targetSeat} is already assigned to ${occupied.name}.`);
      return;
    }
    const existingDemo = demoAt(targetSeat);
    if (existingDemo) {
      setError(`${targetSeat} is already being used for another demo.`);
      return;
    }
    if (phone) {
      const activeMember = findMemberByPhone(data.members, phone);
      if (activeMember?.active) {
        setError(
          `${phone} already belongs to ${activeMember.name}, active in ${activeMember.seat}.`,
        );
        return;
      }
      const duplicateDemo = data.demoSeats.find(
        (item) =>
          item.phone &&
          normalizeMemberPhone(item.phone) === normalizeMemberPhone(phone),
      );
      if (duplicateDemo) {
        setError(
          `${phone} is already in demo at ${duplicateDemo.seat} for ${duplicateDemo.shift}.`,
        );
        return;
      }
    }
    setError("");
    setSaving(true);
    try {
      const saved = await commit(
        (next) => {
          next.demoSeats.push({
            id: uid(),
            seat: targetSeat,
            shift: selectedShift,
            name,
            phone,
          });
        },
        name
          ? `${name} started a demo in ${targetSeat}`
          : `${targetSeat} started a demo`,
      );
      if (saved) close();
    } finally {
      setSaving(false);
    }
  }

  async function stopDemo() {
    setSaving(true);
    try {
      const saved = await commit((next) => {
        next.demoSeats = next.demoSeats.filter(
          (item) =>
            item.seat !== seat ||
            !shiftsOverlap(next.settings.shifts, item.shift, selectedShift),
        );
      }, `${seat} demo stopped`);
      if (saved) close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={close} fixedLayout={showDemoForm}>
      <ModalHeader
        eyebrow={demo?.name ? "Demo visitor" : "Seat options"}
        title={demo?.name || seat}
        text={
          demo?.phone ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>
                {demo.phone} · {demo.seat} · {demo.shift}
              </span>
              <PhoneLink
                phone={demo.phone}
                name={demo.name || "Demo visitor"}
                className="!size-7"
              />
            </span>
          ) : (
            `${selectedShift}${selected ? ` · ${shiftTiming(selected)}` : ""}`
          )
        }
        onClose={close}
      />
      {member ? (
        <>
          <p className="modal-note">
            This seat is now assigned to {member.name}. Open the member profile
            to continue.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
            <Button onClick={() => setModal({ type: "info", id: member.id })}>
              View member
            </Button>
          </div>
        </>
      ) : demo ? (
        <>
          <div className="status-demo-surface rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <strong className="block text-slate-900">
                  {demo.name || "Anonymous demo"}
                </strong>
                <small className="text-slate-600">
                  {demo.seat} · {demo.shift}
                </small>
              </div>
              <StatusPill tone="demo">Demo</StatusPill>
            </div>
          </div>
          <div className="modal-actions">
            <Button
              variant="secondary"
              disabled={saving}
              loading={saving}
              onClick={() => void stopDemo()}
            >
              Stop demo
            </Button>
            <Button
              disabled={saving}
              onClick={() =>
                setModal({
                  type: "member",
                  seat: demo.seat,
                  shift: demo.shift,
                  demoId: demo.id,
                })
              }
            >
              Admit member
            </Button>
          </div>
        </>
      ) : showDemoForm ? (
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void startDemo(valuesFrom(event.currentTarget));
          }}
        >
          <div className="member-form-fields min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 pr-1">
            <label>
              Full name
              <input
                name="name"
                autoFocus
                required
                maxLength={120}
                placeholder="Visitor name"
              />
            </label>
            <label>
              Phone number
              <input
                name="phone"
                inputMode="numeric"
                pattern="[0-9]{10}"
                required
                placeholder="10-digit number"
              />
            </label>
            <label>
              Demo seat
              <select name="seat" defaultValue={seat}>
                {availableSeats.map((option) => {
                  const occupied = occupiedAt(option);
                  const existingDemo = demoAt(option);
                  return (
                    <option
                      key={option}
                      value={option}
                      disabled={Boolean(occupied || existingDemo)}
                    >
                      {option}
                      {occupied
                        ? ` — occupied by ${occupied.name}`
                        : existingDemo
                          ? " — already in demo"
                          : option === seat
                            ? " — selected"
                            : " — available"}
                    </option>
                  );
                })}
              </select>
            </label>
            {error && <p className="field-error">{error}</p>}
          </div>
          <div className="modal-fixed-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setShowDemoForm(false)}
            >
              Back
            </Button>
            <Button type="submit" loading={saving}>
              Start demo
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="modal-note">
            Start a demo to hold this seat, or assign it directly to a member.
          </p>
          <div className="modal-actions">
            <Button
              variant="secondary"
              disabled={saving}
              loading={saving}
              onClick={() =>
                data.settings.trackDemoVisitors
                  ? setShowDemoForm(true)
                  : void startDemo()
              }
            >
              Start demo
            </Button>
            <Button
              disabled={saving}
              onClick={() =>
                setModal({ type: "member", seat, shift: selectedShift })
              }
            >
              Add member
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function MemberFormDialog({
  modal,
  data,
  shift,
  commit,
  close,
  setModal,
}: CommonProps & {
  modal: ModalState;
  shift: string;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const reactivation =
    modal.type === "member-reactivate"
      ? data.members.find((member) => member.id === modal.id)
      : undefined;
  const sourceDemo =
    modal.type === "member" && modal.demoId
      ? data.demoSeats.find((demo) => demo.id === modal.demoId)
      : undefined;
  const [error, setError] = useState("");
  const [recordPayment, setRecordPayment] = useState(
    data.settings.feeCollection !== "later",
  );
  const [pending, setPending] = useState<{
    values: Values;
    existing?: Member;
    overlap?: Payment;
  } | null>(null);
  const [activeMatch, setActiveMatch] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);
  const shifts = configuredShifts(data.settings);
  const seats = seatCodes(data.settings);
  const collectInAdvance = data.settings.feeCollection !== "later";
  const defaultShift =
    reactivation?.shift ||
    sourceDemo?.shift ||
    (modal.type === "member" ? modal.shift : "") ||
    shift;
  const defaultSeat =
    reactivation?.seat ||
    sourceDemo?.seat ||
    (modal.type === "member" ? modal.seat : "") ||
    seats[0];
  const initialFee =
    reactivation?.fee ?? defaultFeeForSeat(data.settings, defaultSeat);
  const initialPlanMonths = reactivation?.planMonths || 1;
  const initialPlanStart = reactivation?.planStart || localDate();
  const initialDuration = reactivation
    ? durationSelection(
        initialPlanStart,
        reactivation.expiry,
        initialPlanMonths,
      )
    : String(initialPlanMonths);
  const [memberFee, setMemberFee] = useState<number | string>(initialFee);
  const [planDuration, setPlanDuration] = useState(initialDuration);
  const [planStart, setPlanStart] = useState(initialPlanStart);
  const [customPlanEnd, setCustomPlanEnd] = useState(
    reactivation?.expiry || addMonths(initialPlanStart, initialPlanMonths),
  );
  const [firstPaymentAmount, setFirstPaymentAmount] = useState<number | string>(
    initialFee * initialPlanMonths,
  );

  async function save(values: Values, existing = reactivation) {
    const shouldRecordPayment = collectInAdvance && recordPayment;
    const expiry = endForDuration(
      values.start,
      values.months,
      values.periodEnd,
    );
    const planMonths = monthsForStorage(values.start, values.months, expiry);
    setSaving(true);
    try {
      const saved = await commit(
        (next) => {
          let target = existing
            ? next.members.find((member) => member.id === existing.id)
            : undefined;
          if (target)
            Object.assign(target, {
              name: values.name.trim(),
              phone: values.phone,
              seat: values.seat,
              shift: values.shift,
              fee: Number(values.fee),
              planStart: values.start,
              planMonths,
              expiry,
              active: true,
            });
          else {
            target = {
              id: uid(),
              name: values.name.trim(),
              phone: values.phone,
              seat: values.seat,
              shift: values.shift,
              fee: Number(values.fee),
              start: values.start,
              planStart: values.start,
              planMonths,
              expiry,
              active: true,
            };
            next.members.push(target);
          }
          if (shouldRecordPayment)
            next.fees.push(
              paymentFrom(target, { ...values, periodStart: values.start }),
            );
          next.demoSeats = next.demoSeats.filter(
            (demo) =>
              demo.id !== sourceDemo?.id &&
              (demo.seat !== values.seat ||
                !shiftsOverlap(next.settings.shifts, demo.shift, values.shift)),
          );
        },
        shouldRecordPayment
          ? existing
            ? "Member reactivated and payment recorded"
            : "Member and first payment recorded"
          : existing
            ? "Member reactivated — payment marked overdue"
            : "Member added — payment marked overdue",
      );
      if (saved) close();
      return saved;
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = valuesFrom(event.currentTarget);
    const periodEnd = endForDuration(
      values.start,
      values.months,
      values.periodEnd,
    );
    if (!periodEnd || periodEnd <= values.start) {
      setError("The membership end date must be after its start date.");
      return;
    }
    const phoneMatch = findMemberByPhone(
      data.members,
      values.phone,
      reactivation?.id,
    );
    if (phoneMatch?.active) {
      setError("");
      setActiveMatch(phoneMatch);
      return;
    }
    if (reactivation && phoneMatch) {
      setError(
        `${values.phone} belongs to the inactive record for ${phoneMatch.name}. Reactivate that member instead.`,
      );
      return;
    }
    const existing = reactivation || phoneMatch;
    const conflict = data.members.find(
      (member) =>
        member.active &&
        member.id !== existing?.id &&
        member.seat === values.seat &&
        shiftsOverlap(shifts, member.shift, values.shift),
    );
    if (conflict) {
      setError(
        `${values.seat} is already assigned to ${conflict.name} in an overlapping shift.`,
      );
      return;
    }
    setError("");
    if (existing || !(collectInAdvance && recordPayment)) {
      const overlap =
        existing && collectInAdvance && recordPayment
          ? findOverlappingPayment(
              data.fees,
              existing.id,
              values.start,
              periodEnd,
            )
          : undefined;
      setPending({ values, existing, overlap });
      return;
    }
    await save(values);
  }

  return (
    <>
      <Modal onClose={close} fixedLayout>
        <ModalHeader
          eyebrow={
            reactivation
              ? "Reactivate member"
              : sourceDemo
                ? "Demo admission"
                : "New admission"
          }
          title={
            reactivation
              ? `Welcome back, ${reactivation.name}`
              : sourceDemo?.name
                ? `Admit ${sourceDemo.name}`
                : "Add a member"
          }
          text="Assign a plan and seat. Membership dates can be corrected later."
          onClose={close}
        />
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="member-form-fields min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Full name
                <input
                  name="name"
                  autoFocus
                  required
                  maxLength={120}
                  defaultValue={reactivation?.name || sourceDemo?.name || ""}
                  placeholder="Member name"
                />
              </label>
              <label>
                Phone number
                <input
                  name="phone"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  required
                  defaultValue={reactivation?.phone || sourceDemo?.phone || ""}
                  placeholder="10-digit number"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Shift
                <select name="shift" defaultValue={defaultShift}>
                  {shifts.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name} · {shiftTiming(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Seat
                <select
                  name="seat"
                  defaultValue={defaultSeat}
                  onChange={(event) => {
                    if (reactivation) return;
                    const rate = defaultFeeForSeat(
                      data.settings,
                      event.target.value,
                    );
                    setMemberFee(rate);
                  }}
                >
                  {seats.map((seat) => (
                    <option key={seat}>{seat}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Monthly fee (₹)
                <input
                  name="fee"
                  type="number"
                  min={0}
                  value={memberFee}
                  onChange={(event) => {
                    const fee = event.target.value;
                    setMemberFee(fee);
                    if (planDuration !== CUSTOM_DURATION)
                      setFirstPaymentAmount(
                        Number(fee) * (Number(planDuration) || 1),
                      );
                  }}
                  required
                />
              </label>
              <label>
                Plan duration
                <select
                  name="months"
                  value={planDuration}
                  onChange={(event) => {
                    const duration = event.target.value;
                    setPlanDuration(duration);
                    if (duration !== CUSTOM_DURATION)
                      setFirstPaymentAmount(
                        Number(memberFee) * (Number(duration) || 1),
                      );
                    else if (customPlanEnd <= planStart)
                      setCustomPlanEnd(addMonths(planStart, 1));
                  }}
                >
                  <DurationOptions />
                </select>
              </label>
            </div>
            <label>
              Membership period starts
              <input
                name="start"
                type="date"
                value={planStart}
                onChange={(event) => {
                  const start = event.target.value;
                  setPlanStart(start);
                  if (customPlanEnd <= start)
                    setCustomPlanEnd(addMonths(start, 1));
                }}
                required
              />
            </label>
            {planDuration === CUSTOM_DURATION && (
              <label>
                Membership period ends
                <input
                  name="periodEnd"
                  type="date"
                  min={planStart}
                  value={customPlanEnd}
                  onChange={(event) => setCustomPlanEnd(event.target.value)}
                  required
                />
              </label>
            )}
            {collectInAdvance && (
              <label className="flex cursor-pointer grid-cols-[auto_1fr] items-start gap-3 rounded-2xl bg-slate-100 p-3.5">
                <input
                  className="!mt-1 !size-4 !min-h-0 !w-4"
                  type="checkbox"
                  checked={recordPayment}
                  onChange={(event) => setRecordPayment(event.target.checked)}
                />
                <span>
                  <strong className="block">Record first payment now</strong>
                  <small className="font-medium text-slate-600">
                    Recommended for advance-fee libraries. Turn this off to
                    admit with payment due.
                  </small>
                </span>
              </label>
            )}
            {collectInAdvance && recordPayment && (
              <fieldset className="rounded-2xl border border-slate-200 p-3.5">
                <legend className="px-2 text-sm font-extrabold">
                  First payment
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {planDuration === CUSTOM_DURATION ? (
                    <label>
                      Amount received (₹)
                      <input
                        name="amount"
                        type="number"
                        min={0}
                        value={firstPaymentAmount}
                        onChange={(event) =>
                          setFirstPaymentAmount(event.target.value)
                        }
                        required
                      />
                    </label>
                  ) : (
                    <PaymentAmountSummary
                      monthlyFee={Number(memberFee) || 0}
                      months={Number(planDuration) || 1}
                    />
                  )}
                  <label>
                    Payment mode
                    <select name="paymentMode">
                      <PaymentModeOptions />
                    </select>
                  </label>
                </div>
                <label className="mt-3">
                  Payment date
                  <input
                    name="paymentDate"
                    type="date"
                    max={localDate()}
                    defaultValue={localDate()}
                    required
                  />
                </label>
              </fieldset>
            )}
            {error && <p className="field-error">{error}</p>}
          </div>
          <div className="modal-fixed-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={close}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {reactivation ? "Reactivate member" : "Add member"}
            </Button>
          </div>
        </form>
      </Modal>
      {pending && (
        <ConfirmDialog
          title={
            pending.existing
              ? `Reactivate ${pending.existing.name}?`
              : "Admit without advance payment?"
          }
          text={
            pending.existing
              ? `${pending.existing.name}'s history will be kept and the member will become active on ${pending.values.seat}.${recordPayment ? " The first payment will also be recorded." : " No payment will be recorded yet."}${pending.overlap ? ` Warning: an existing payment already covers ${prettyDate(pending.overlap.periodStart)}–${prettyDate(pending.overlap.periodEnd)}.` : ""}`
              : "The member will be active and the seat will be reserved, but the first payment will remain due."
          }
          confirmLabel={pending.existing ? "Reactivate" : "Add without payment"}
          onCancel={() => setPending(null)}
          onConfirm={() => save(pending.values, pending.existing)}
        />
      )}
      {activeMatch && (
        <ConfirmDialog
          title="This member already exists"
          text={`${activeMatch.name} already uses ${activeMatch.phone} and is active in ${activeMatch.seat} for ${activeMatch.shift}.`}
          confirmLabel="View member"
          onCancel={() => setActiveMatch(null)}
          onConfirm={() => setModal({ type: "info", id: activeMatch.id })}
        />
      )}
    </>
  );
}

function RenewDialog({
  member,
  data,
  commit,
  close,
}: CommonProps & { member: Member }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingPayment, setPendingPayment] = useState<Payment | null>(null);
  const payments = data.fees.filter(
    (payment) => payment.memberId === member.id,
  );
  const firstPayment = payments.length === 0;
  const paymentDue = !currentPaymentForMember(member, payments);
  const defaultStart = paymentDue
    ? member.planStart || member.start
    : daysUntil(member.expiry) >= 0
      ? member.expiry
      : localDate();
  const defaultMonths = paymentDue ? member.planMonths || 1 : 1;
  const defaultDuration = paymentDue
    ? durationSelection(defaultStart, member.expiry, defaultMonths)
    : String(defaultMonths);
  const seatRangeRate = defaultFeeForSeat(data.settings, member.seat);
  const [periodDuration, setPeriodDuration] = useState(defaultDuration);
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [customPeriodEnd, setCustomPeriodEnd] = useState(
    paymentDue && defaultDuration === CUSTOM_DURATION
      ? member.expiry
      : addMonths(defaultStart, defaultMonths),
  );
  const [paymentAmount, setPaymentAmount] = useState<number | string>(
    seatRangeRate * defaultMonths,
  );

  async function savePayment(payment: Payment) {
    setSaving(true);
    try {
      const saved = await commit(
        (next) => {
          const target = next.members.find((item) => item.id === member.id)!;
          next.fees.push(payment);
          updateCurrentPlan(target, payment, paymentDue);
        },
        paymentDue
          ? "Payment recorded and overdue status cleared"
          : "Payment recorded and membership updated",
      );
      if (saved) close();
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = valuesFrom(event.currentTarget);
    const periodEnd = endForDuration(
      values.periodStart,
      values.months,
      values.periodEnd,
    );
    if (!periodEnd || periodEnd <= values.periodStart) {
      setError("The covered period must end after it starts.");
      return;
    }
    setError("");
    const payment = paymentFrom(member, values);
    const overlap = findOverlappingPayment(
      data.fees,
      member.id,
      payment.periodStart,
      payment.periodEnd,
    );
    if (overlap) {
      setPendingPayment(payment);
      return;
    }
    await savePayment(payment);
  }

  const overlap = pendingPayment
    ? findOverlappingPayment(
        data.fees,
        member.id,
        pendingPayment.periodStart,
        pendingPayment.periodEnd,
      )
    : undefined;

  return (
    <>
      <Modal onClose={close} fixedLayout>
        <ModalHeader
          eyebrow={
            firstPayment
              ? "First payment"
              : paymentDue
                ? "Payment due"
                : "Collect fee"
          }
          title={
            paymentDue ? `Collect from ${member.name}` : `Renew ${member.name}`
          }
          text={`${member.seat} · Currently valid until ${prettyDate(member.expiry)}`}
          onClose={close}
        />
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="member-form-fields min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Amount received (₹)
                <input
                  name="amount"
                  type="number"
                  min={0}
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  required
                />
                <small className="mt-1 block font-medium text-slate-500">
                  Suggested from {member.seat}’s range: {money(seatRangeRate)}
                  /month
                </small>
              </label>
              <label>
                Payment mode
                <select name="mode">
                  <PaymentModeOptions />
                </select>
              </label>
            </div>
            <label>
              Payment date
              <input
                name="date"
                type="date"
                max={localDate()}
                defaultValue={localDate()}
                required
              />
            </label>
            <fieldset className="rounded-2xl border border-slate-200 p-3.5">
              <legend className="px-2 text-sm font-extrabold">
                Membership period covered
              </legend>
              <p className="mb-3 text-sm text-slate-600">
                Payment date and membership start can differ for late or
                backdated collections.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  Period starts
                  <input
                    name="periodStart"
                    type="date"
                    value={periodStart}
                    onChange={(event) => {
                      const start = event.target.value;
                      setPeriodStart(start);
                      if (customPeriodEnd <= start)
                        setCustomPeriodEnd(addMonths(start, 1));
                    }}
                    required
                  />
                </label>
                <label>
                  Duration
                  <select
                    name="months"
                    value={periodDuration}
                    onChange={(event) => {
                      const duration = event.target.value;
                      setPeriodDuration(duration);
                      if (duration !== CUSTOM_DURATION)
                        setPaymentAmount(
                          seatRangeRate * (Number(duration) || 1),
                        );
                      else if (customPeriodEnd <= periodStart)
                        setCustomPeriodEnd(addMonths(periodStart, 1));
                    }}
                  >
                    <DurationOptions />
                  </select>
                </label>
                {periodDuration === CUSTOM_DURATION && (
                  <label className="sm:col-span-2">
                    Period ends
                    <input
                      name="periodEnd"
                      type="date"
                      min={periodStart}
                      value={customPeriodEnd}
                      onChange={(event) =>
                        setCustomPeriodEnd(event.target.value)
                      }
                      required
                    />
                  </label>
                )}
              </div>
            </fieldset>
            {error && <p className="field-error">{error}</p>}
            <p className="modal-note !p-3.5">
              A period ending before a later recorded plan is archived without
              shortening the current validity.
            </p>
          </div>
          <div className="modal-fixed-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={close}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Record payment
            </Button>
          </div>
        </form>
      </Modal>
      {pendingPayment && overlap && (
        <ConfirmDialog
          title="This period already has a payment"
          text={`The existing ${money(overlap.amount)} payment covers ${prettyDate(overlap.periodStart)}–${prettyDate(overlap.periodEnd)}. Add another payment covering ${prettyDate(pendingPayment.periodStart)}–${prettyDate(pendingPayment.periodEnd)} anyway?`}
          confirmLabel="Add overlapping payment"
          onCancel={() => setPendingPayment(null)}
          onConfirm={() => savePayment(pendingPayment)}
        />
      )}
    </>
  );
}

function PaymentEditDialog({
  payment,
  member,
  payments,
  commit,
  close,
}: {
  payment: Payment;
  member?: Member;
  payments: Payment[];
  commit: WorkspaceCommit;
  close: () => void;
}) {
  const [pending, setPending] = useState<
    (Values & { periodEnd: string; storedMonths: string }) | null
  >(null);
  const [olderConfirmed, setOlderConfirmed] = useState(
    daysSince(payment.date) <= PAYMENT_EDIT_REVIEW_DAYS,
  );
  const [saving, setSaving] = useState(false);
  const periodStart = payment.periodStart || payment.date;
  const initialDuration = durationSelection(
    periodStart,
    payment.periodEnd,
    payment.periodMonths,
  );
  const [editPeriodStart, setEditPeriodStart] = useState(periodStart);
  const [editDuration, setEditDuration] = useState(initialDuration);
  const [customPeriodEnd, setCustomPeriodEnd] = useState(payment.periodEnd);
  const [error, setError] = useState("");
  const review = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = valuesFrom(event.currentTarget);
    const periodEnd = endForDuration(
      values.periodStart,
      values.months,
      values.periodEnd,
    );
    if (!periodEnd || periodEnd <= values.periodStart) {
      setError("The covered period must end after it starts.");
      return;
    }
    setError("");
    setPending({
      ...values,
      periodEnd,
      storedMonths: String(
        monthsForStorage(values.periodStart, values.months, periodEnd),
      ),
    });
  };
  async function save() {
    if (!pending) return;
    setSaving(true);
    try {
      const saved = await commit((next) => {
        const target = next.fees.find((item) => item.id === payment.id)!;
        const linked = next.members.find(
          (item) => item.id === payment.memberId,
        );
        const anchored = linked?.expiry === payment.periodEnd;
        Object.assign(target, {
          amount: Number(pending.amount),
          date: pending.date,
          mode: pending.mode as PaymentMode,
          periodStart: pending.periodStart,
          periodMonths: Number(pending.storedMonths),
          periodEnd: pending.periodEnd,
        });
        if (linked && (anchored || pending.periodEnd >= linked.expiry))
          updateCurrentPlan(linked, target, true);
      }, "Payment updated");
      if (saved) close();
    } finally {
      setSaving(false);
    }
  }
  const overlappingPayment = pending
    ? findOverlappingPayment(
        payments,
        payment.memberId,
        pending.periodStart,
        pending.periodEnd,
        payment.id,
      )
    : undefined;
  if (!olderConfirmed)
    return (
      <ConfirmDialog
        title="Edit an older payment?"
        text={`This payment was recorded on ${prettyDate(payment.date)}. Older corrections can affect historical reports, so review the amount, date, and covered period carefully.`}
        confirmLabel="Continue to edit"
        onCancel={close}
        onConfirm={() => setOlderConfirmed(true)}
      />
    );
  if (pending)
    return (
      <Modal onClose={() => setPending(null)}>
        <ModalHeader
          eyebrow="Confirm change"
          title="Update this payment?"
          text={`${payment.memberName || member?.name || "Member"} · ${money(pending.amount)} · ${prettyDate(pending.date)}`}
          onClose={() => setPending(null)}
        />
        <p className="modal-note">
          Covered period: {prettyDate(pending.periodStart)}–
          {prettyDate(pending.periodEnd)}. Current membership changes only if
          this represents the latest plan.
          {overlappingPayment &&
            ` Warning: another payment already covers ${prettyDate(overlappingPayment.periodStart)}–${prettyDate(overlappingPayment.periodEnd)}.`}
        </p>
        <div className="modal-actions">
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => setPending(null)}
          >
            Go back
          </Button>
          <Button loading={saving} onClick={save}>
            Confirm update
          </Button>
        </div>
      </Modal>
    );
  return (
    <Modal onClose={close}>
      <ModalHeader
        eyebrow="Payment correction"
        title="Edit payment"
        text={`${payment.memberName || member?.name || "Member"} · ${payment.seat || member?.seat || "Seat not recorded"}`}
        onClose={close}
      />
      <form className="form-stack" onSubmit={review}>
        <div className="form-grid">
          <label>
            Amount (₹)
            <input
              name="amount"
              type="number"
              min={0}
              defaultValue={payment.amount}
              required
            />
          </label>
          <label>
            Payment mode
            <select name="mode" defaultValue={payment.mode}>
              <PaymentModeOptions />
            </select>
          </label>
        </div>
        <label>
          Payment date
          <input
            name="date"
            type="date"
            max={localDate()}
            defaultValue={payment.date}
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Period starts
            <input
              name="periodStart"
              type="date"
              value={editPeriodStart}
              onChange={(event) => {
                const start = event.target.value;
                setEditPeriodStart(start);
                if (customPeriodEnd <= start)
                  setCustomPeriodEnd(addMonths(start, 1));
              }}
              required
            />
          </label>
          <label>
            Duration
            <select
              name="months"
              value={editDuration}
              onChange={(event) => {
                const duration = event.target.value;
                setEditDuration(duration);
                if (
                  duration === CUSTOM_DURATION &&
                  customPeriodEnd <= editPeriodStart
                )
                  setCustomPeriodEnd(addMonths(editPeriodStart, 1));
              }}
            >
              <DurationOptions />
            </select>
          </label>
        </div>
        {editDuration === CUSTOM_DURATION && (
          <label>
            Period ends
            <input
              name="periodEnd"
              type="date"
              min={editPeriodStart}
              value={customPeriodEnd}
              onChange={(event) => setCustomPeriodEnd(event.target.value)}
              required
            />
          </label>
        )}
        {error && <p className="field-error">{error}</p>}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit">Review update</Button>
        </div>
      </form>
    </Modal>
  );
}

function ProfileDialog({
  member,
  data,
  close,
  setModal,
}: {
  member: Member;
  data: WorkspaceData;
  close: () => void;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const payments = data.fees.filter(
    (payment) => payment.memberId === member.id,
  );
  const status = memberStatus(member, payments);
  const profileTone = member.active ? status.tone : "neutral";
  const details = [
    { label: "Seat", value: member.seat },
    {
      label: "Status",
      value: member.active ? status.label : "Deactivated",
      status: true,
    },
    { label: "Shift", value: member.shift },
    { label: "Monthly fee", value: money(member.fee) },
    {
      label: "Current plan",
      value: `${prettyDate(member.planStart || member.start)}–${prettyDate(member.expiry)}`,
      wide: true,
    },
    { label: "Member since", value: prettyDate(member.start) },
    {
      label: "Total collected",
      value: money(payments.reduce((sum, item) => sum + item.amount, 0)),
    },
  ];
  return (
    <Modal onClose={close} fixedLayout>
      <ModalHeader
        eyebrow="Member profile"
        title={member.name}
        text={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>
              {member.phone} · {member.active ? status.label : "Deactivated"}
            </span>
            <PhoneLink
              phone={member.phone}
              name={member.name}
              className="!size-7"
            />
          </span>
        }
        onClose={close}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8 pr-1 sm:pb-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200">
          {details.map((detail) => (
            <div
              key={detail.label}
              className={`${detail.wide ? "col-span-2" : ""} p-3.5 sm:p-4 ${detail.status ? statusSurfaceStyles[profileTone] : "bg-slate-50"}`}
            >
              <dt
                className={`text-[11px] font-extrabold tracking-wide uppercase ${detail.status ? "opacity-65" : "text-slate-500"}`}
              >
                {detail.label}
              </dt>
              <dd
                className={`mt-1 text-sm font-extrabold leading-snug sm:text-base ${detail.status ? "" : "text-slate-900"}`}
              >
                {detail.value}
              </dd>
              {detail.label === "Seat" && member.active && (
                <button
                  className="mt-1 text-xs font-extrabold text-[var(--brand)] underline"
                  onClick={() =>
                    setModal({ type: "seat-change", id: member.id })
                  }
                >
                  Change seat
                </button>
              )}
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => setModal({ type: "member-fees", id: member.id })}
          className="mt-3 flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-400"
        >
          <span>
            <strong className="block text-slate-900">Payment history</strong>
            <small className="text-slate-600">
              See every amount, date, mode, and covered period
            </small>
          </span>
          <StatusPill tone="neutral">{payments.length}</StatusPill>
        </button>
      </div>
      <div className="modal-fixed-actions sm:grid-cols-3">
        <Button
          variant="secondary"
          onClick={() => setModal({ type: "member-edit", id: member.id })}
        >
          Edit details
        </Button>
        {member.active ? (
          <>
            <Button onClick={() => setModal({ type: "renew", id: member.id })}>
              {status.currentPayment ? "Collect fee" : "Add payment"}
            </Button>
            <Button
              className="col-span-2 sm:col-span-1"
              variant="danger"
              onClick={() =>
                setModal({ type: "member-deactivate", id: member.id })
              }
            >
              Deactivate
            </Button>
          </>
        ) : (
          <Button
            className="col-span-2"
            onClick={() =>
              setModal({ type: "member-reactivate", id: member.id })
            }
          >
            Reactivate
          </Button>
        )}
      </div>
    </Modal>
  );
}

function MemberFeesDialog({
  member,
  data,
  close,
  setModal,
}: {
  member: Member;
  data: WorkspaceData;
  close: () => void;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const payments = data.fees
    .filter((payment) => payment.memberId === member.id)
    .sort(
      (first, second) =>
        second.date.localeCompare(first.date) ||
        second.periodStart.localeCompare(first.periodStart),
    );
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const back = () => setModal({ type: "info", id: member.id });

  return (
    <Modal onClose={close} fixedLayout>
      <ModalHeader
        eyebrow="Payment history"
        title={member.name}
        text={`${payments.length} ${payments.length === 1 ? "payment" : "payments"} · ${money(total)} collected`}
        onClose={close}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8 pr-1 sm:pb-6">
        {payments.length ? (
          <div className="grid gap-3">
            {payments.map((payment) => (
              <article
                key={payment.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="block text-slate-900">
                      {prettyDate(payment.date)}
                    </strong>
                    <small className="text-slate-600">
                      {payment.mode} · {payment.seat || member.seat}
                    </small>
                  </div>
                  <strong className="text-lg text-slate-900">
                    {money(payment.amount)}
                  </strong>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Covers {prettyDate(payment.periodStart)}–
                  {prettyDate(payment.periodEnd)}
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs font-extrabold text-[var(--brand)] underline underline-offset-2"
                  onClick={() =>
                    setModal({
                      type: "payment-edit",
                      id: payment.id,
                      returnToMemberId: member.id,
                    })
                  }
                >
                  Edit payment
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No payments yet"
            text="The member’s recorded fee payments will appear here."
          />
        )}
      </div>
      <div className="modal-fixed-actions">
        <Button variant="secondary" onClick={back}>
          Back to profile
        </Button>
        {member.active && (
          <Button onClick={() => setModal({ type: "renew", id: member.id })}>
            Add payment
          </Button>
        )}
      </div>
    </Modal>
  );
}

function EditMemberDialog({
  member,
  data,
  commit,
  setModal,
}: {
  member: Member;
  data: WorkspaceData;
  commit: WorkspaceCommit;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const shifts = configuredShifts(data.settings);
  const back = () => setModal({ type: "info", id: member.id });
  const initialPlanStart = member.planStart || member.start;
  const [planStart, setPlanStart] = useState(initialPlanStart);
  const [planDuration, setPlanDuration] = useState(
    durationSelection(initialPlanStart, member.expiry, member.planMonths),
  );
  const [customPlanEnd, setCustomPlanEnd] = useState(member.expiry);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = valuesFrom(event.currentTarget);
    const expiry = endForDuration(
      values.planStart,
      values.planMonths,
      values.periodEnd,
    );
    if (!expiry || expiry <= values.planStart) {
      setError("The membership end date must be after its start date.");
      return;
    }
    const duplicate = findMemberByPhone(data.members, values.phone, member.id);
    if (duplicate) {
      setError(
        `${values.phone} already belongs to ${duplicate.name}. Phone numbers must be unique.`,
      );
      return;
    }
    const conflict = data.members.find(
      (item) =>
        member.active &&
        item.active &&
        item.id !== member.id &&
        item.seat === member.seat &&
        shiftsOverlap(shifts, item.shift, values.shift),
    );
    if (conflict) {
      setError(
        `${member.seat} is already assigned to ${conflict.name} in an overlapping shift.`,
      );
      return;
    }
    const demoConflict = demosForSeat(data, member.seat, values.shift)[0];
    if (member.active && demoConflict) {
      setError(
        `${member.seat} is currently in demo use for an overlapping shift. Stop that demo before changing this member’s shift.`,
      );
      return;
    }
    setSaving(true);
    try {
      const saved = await commit((next) => {
        const target = next.members.find((item) => item.id === member.id)!;
        Object.assign(target, {
          name: values.name.trim(),
          phone: values.phone,
          shift: values.shift,
          fee: Number(values.fee),
          planStart: values.planStart,
          planMonths: monthsForStorage(
            values.planStart,
            values.planMonths,
            expiry,
          ),
          expiry,
        });
      }, "Member details updated");
      if (saved) back();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal onClose={back} fixedLayout>
      <ModalHeader
        eyebrow="Edit member"
        title="Update details"
        text={`${member.seat} · Payment-history snapshots stay unchanged`}
        onClose={back}
      />
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <div className="member-form-fields min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              Full name
              <input
                name="name"
                defaultValue={member.name}
                maxLength={120}
                autoFocus
                required
              />
            </label>
            <label>
              Phone number
              <input
                name="phone"
                defaultValue={member.phone}
                inputMode="numeric"
                pattern="[0-9]{10}"
                required
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              Shift
              <select name="shift" defaultValue={member.shift}>
                {shifts.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name} · {shiftTiming(item)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Monthly fee (₹)
              <input
                name="fee"
                type="number"
                min={0}
                defaultValue={member.fee}
                required
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              Period starts
              <input
                name="planStart"
                type="date"
                value={planStart}
                onChange={(event) => {
                  const start = event.target.value;
                  setPlanStart(start);
                  if (customPlanEnd <= start)
                    setCustomPlanEnd(addMonths(start, 1));
                }}
                required
              />
            </label>
            <label>
              Duration
              <select
                name="planMonths"
                value={planDuration}
                onChange={(event) => {
                  const duration = event.target.value;
                  setPlanDuration(duration);
                  if (
                    duration === CUSTOM_DURATION &&
                    customPlanEnd <= planStart
                  )
                    setCustomPlanEnd(addMonths(planStart, 1));
                }}
              >
                <DurationOptions />
              </select>
            </label>
          </div>
          {planDuration === CUSTOM_DURATION && (
            <label>
              Period ends
              <input
                name="periodEnd"
                type="date"
                min={planStart}
                value={customPlanEnd}
                onChange={(event) => setCustomPlanEnd(event.target.value)}
                required
              />
            </label>
          )}
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="modal-fixed-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={back}
          >
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save details
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ChangeSeatDialog({
  member,
  data,
  commit,
  setModal,
}: {
  member: Member;
  data: WorkspaceData;
  commit: WorkspaceCommit;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const shifts = configuredShifts(data.settings);
  const back = () => setModal({ type: "info", id: member.id });
  const occupiedBy = (seat: string) =>
    data.members.find(
      (item) =>
        item.active &&
        item.id !== member.id &&
        item.seat === seat &&
        shiftsOverlap(shifts, item.shift, member.shift),
    );
  const demoAt = (seat: string) => demosForSeat(data, seat, member.shift)[0];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seat = valuesFrom(event.currentTarget).seat;
    const conflict = occupiedBy(seat);
    if (conflict) {
      setError(
        `${seat} is already assigned to ${conflict.name} in an overlapping shift.`,
      );
      return;
    }
    if (seat === member.seat) {
      back();
      return;
    }
    setSaving(true);
    try {
      const saved = await commit((next) => {
        next.members.find((item) => item.id === member.id)!.seat = seat;
        next.demoSeats = next.demoSeats.filter(
          (demo) =>
            demo.seat !== seat ||
            !shiftsOverlap(next.settings.shifts, demo.shift, member.shift),
        );
      }, `Seat changed to ${seat}`);
      if (saved) back();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal onClose={back}>
      <ModalHeader
        eyebrow="Change seat"
        title={`Move ${member.name}`}
        text={`${member.shift} · Currently ${member.seat}`}
        onClose={back}
      />
      <form className="form-stack" onSubmit={submit}>
        <label>
          New seat
          <select name="seat" defaultValue={member.seat}>
            {seatCodes(data.settings).map((seat) => {
              const conflict = occupiedBy(seat);
              const demo = demoAt(seat);
              return (
                <option key={seat} value={seat} disabled={Boolean(conflict)}>
                  {seat}
                  {conflict
                    ? ` — occupied by ${conflict.name}`
                    : demo
                      ? " — demo (will stop when assigned)"
                      : seat === member.seat
                        ? " — current seat"
                        : " — available"}
                </option>
              );
            })}
          </select>
        </label>
        <p className="modal-note">
          Earlier payments continue to show the seat used when each payment was
          recorded.
        </p>
        <p className="field-error">{error}</p>
        <div className="modal-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={back}
          >
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save new seat
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function MemberDialogRouter({
  modal,
  data,
  shift,
  commit,
  setModal,
}: {
  modal: ModalState;
  data: WorkspaceData;
  shift: string;
  commit: WorkspaceCommit;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
}) {
  const close = () => setModal(null);
  const livePayment = data.fees.find(
    (item) => item.id === ("id" in modal ? modal.id : ""),
  );
  const [paymentSnapshot, setPaymentSnapshot] = useState(livePayment || null);
  useEffect(() => {
    if (livePayment) setPaymentSnapshot(livePayment);
  }, [livePayment]);
  if (modal.type === "seat-actions")
    return (
      <SeatActionsDialog
        seat={modal.seat}
        selectedShift={modal.shift}
        data={data}
        commit={commit}
        close={close}
        setModal={setModal}
      />
    );
  if (modal.type === "member" || modal.type === "member-reactivate")
    return (
      <MemberFormDialog
        modal={modal}
        data={data}
        shift={shift}
        commit={commit}
        close={close}
        setModal={setModal}
      />
    );
  if (modal.type === "payment-edit" || modal.type === "payment-delete") {
    const payment =
      livePayment ||
      (paymentSnapshot?.id === modal.id ? paymentSnapshot : null);
    if (!payment) return null;
    const member = data.members.find((item) => item.id === payment.memberId);
    if (modal.type === "payment-edit")
      return (
        <PaymentEditDialog
          payment={payment}
          member={member}
          payments={data.fees}
          commit={commit}
          close={
            modal.returnToMemberId
              ? () =>
                  setModal({
                    type: "member-fees",
                    id: modal.returnToMemberId!,
                  })
              : close
          }
        />
      );
    return (
      <ConfirmDialog
        title="Delete this payment?"
        text={`${payment.memberName || member?.name || "Member"} · ${payment.seat || member?.seat || "Seat not recorded"} · ${money(payment.amount)}. Membership dates will stay unchanged.`}
        confirmLabel="Delete payment"
        onCancel={close}
        onConfirm={async () => {
          const saved = await commit((next) => {
            next.fees = next.fees.filter((item) => item.id !== payment.id);
          }, "Payment deleted");
          if (saved) close();
        }}
      />
    );
  }
  const member = data.members.find((item) => item.id === modal.id);
  if (!member) return null;
  if (modal.type === "member-fees")
    return (
      <MemberFeesDialog
        member={member}
        data={data}
        close={close}
        setModal={setModal}
      />
    );
  if (modal.type === "member-edit")
    return (
      <EditMemberDialog
        member={member}
        data={data}
        commit={commit}
        setModal={setModal}
      />
    );
  if (modal.type === "seat-change")
    return (
      <ChangeSeatDialog
        member={member}
        data={data}
        commit={commit}
        setModal={setModal}
      />
    );
  if (modal.type === "renew")
    return (
      <RenewDialog member={member} data={data} commit={commit} close={close} />
    );
  if (modal.type === "member-deactivate")
    return (
      <ConfirmDialog
        title={`Deactivate ${member.name}?`}
        text={`${member.seat} will become available. The member profile and complete payment history will remain in the archive.`}
        confirmLabel="Deactivate member"
        onCancel={() => setModal({ type: "info", id: member.id })}
        onConfirm={async () => {
          const saved = await commit((next) => {
            next.members.find((item) => item.id === member.id)!.active = false;
          }, "Member deactivated");
          if (saved) close();
        }}
      />
    );
  return (
    <ProfileDialog
      member={member}
      data={data}
      close={close}
      setModal={setModal}
    />
  );
}
