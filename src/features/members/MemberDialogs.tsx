import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, Modal, ModalHeader } from "../../components/ui/Modal";
import { statusSurfaceStyles } from "../../components/workspace/memberStatusStyles";
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
  daysUntil,
  localDate,
  money,
  monthsBetween,
  prettyDate,
  uid,
} from "../../utils/format";
import {
  currentPaymentForMember,
  findMemberByIdentity,
  memberStatus,
} from "../../utils/members";
import { seatCodes } from "../../utils/seats";
import {
  configuredShifts,
  shiftTiming,
  shiftsOverlap,
} from "../../utils/shifts";

const DURATION_OPTIONS = [1, 2, 3, 6, 12];
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

function paymentFrom(member: Member, values: Values): Payment {
  const periodMonths = Number(values.months) || 1;
  const periodStart = values.periodStart || values.start;
  return {
    id: uid(),
    memberId: member.id,
    memberName: member.name,
    seat: member.seat,
    amount: Number(values.paymentAmount ?? values.amount),
    date: values.paymentDate ?? values.date,
    mode: (values.paymentMode ?? values.mode) as PaymentMode,
    periodStart,
    periodMonths,
    periodEnd: addMonths(periodStart, periodMonths),
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

function MemberFormDialog({
  modal,
  data,
  shift,
  commit,
  close,
}: CommonProps & { modal: ModalState; shift: string }) {
  const reactivation =
    modal.type === "member-reactivate"
      ? data.members.find((member) => member.id === modal.id)
      : undefined;
  const [error, setError] = useState("");
  const [recordPayment, setRecordPayment] = useState(
    data.settings.feeCollection !== "later",
  );
  const [pending, setPending] = useState<{
    values: Values;
    existing?: Member;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const shifts = configuredShifts(data.settings);
  const seats = seatCodes(data.settings);
  const collectInAdvance = data.settings.feeCollection !== "later";
  const defaultShift =
    reactivation?.shift ||
    (modal.type === "member" ? modal.shift : "") ||
    shift;
  const defaultSeat =
    reactivation?.seat ||
    (modal.type === "member" ? modal.seat : "") ||
    seats[0];

  async function save(values: Values, existing = reactivation) {
    const shouldRecordPayment = collectInAdvance && recordPayment;
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
              planMonths: Number(values.months),
              expiry: addMonths(values.start, values.months),
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
              planMonths: Number(values.months),
              expiry: addMonths(values.start, values.months),
              active: true,
            };
            next.members.push(target);
          }
          if (shouldRecordPayment)
            next.fees.push(
              paymentFrom(target, { ...values, periodStart: values.start }),
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
    const identityMatch = findMemberByIdentity(
      data.members,
      values.name,
      values.phone,
      reactivation?.id,
    );
    if (identityMatch?.active) {
      setError("An active member already uses this name and phone number.");
      return;
    }
    const existing = reactivation || identityMatch;
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
      setPending({ values, existing });
      return;
    }
    await save(values);
  }

  return (
    <>
      <Modal onClose={close} fixedLayout>
        <ModalHeader
          eyebrow={reactivation ? "Reactivate member" : "New admission"}
          title={
            reactivation ? `Welcome back, ${reactivation.name}` : "Add a member"
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
                  defaultValue={reactivation?.name || ""}
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
                  defaultValue={reactivation?.phone || ""}
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
                <select name="seat" defaultValue={defaultSeat}>
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
                  defaultValue={reactivation?.fee || 1200}
                  required
                />
              </label>
              <label>
                Plan duration
                <select
                  name="months"
                  defaultValue={reactivation?.planMonths || 1}
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
                defaultValue={localDate()}
                required
              />
            </label>
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
                  <label>
                    Amount received (₹)
                    <input
                      name="paymentAmount"
                      type="number"
                      min={0}
                      defaultValue={reactivation?.fee || 1200}
                      required
                    />
                  </label>
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
              ? `${pending.existing.name}'s history will be kept and the member will become active on ${pending.values.seat}.${recordPayment ? " The first payment will also be recorded." : " No payment will be recorded yet."}`
              : "The member will be active and the seat will be reserved, but the first payment will remain due."
          }
          confirmLabel={pending.existing ? "Reactivate" : "Add without payment"}
          onCancel={() => setPending(null)}
          onConfirm={() => save(pending.values, pending.existing)}
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payment = paymentFrom(member, valuesFrom(event.currentTarget));
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
  return (
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
                defaultValue={member.fee}
                required
              />
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
              Payment date and membership start can differ for late or backdated
              collections.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Period starts
                <input
                  name="periodStart"
                  type="date"
                  defaultValue={defaultStart}
                  required
                />
              </label>
              <label>
                Duration
                <select
                  name="months"
                  defaultValue={paymentDue ? member.planMonths || 1 : 1}
                >
                  <DurationOptions />
                </select>
              </label>
            </div>
          </fieldset>
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
  );
}

function PaymentEditDialog({
  payment,
  member,
  commit,
  close,
}: {
  payment: Payment;
  member?: Member;
  commit: WorkspaceCommit;
  close: () => void;
}) {
  const [pending, setPending] = useState<
    (Values & { periodEnd: string }) | null
  >(null);
  const [saving, setSaving] = useState(false);
  const periodStart = payment.periodStart || payment.date;
  const review = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = valuesFrom(event.currentTarget);
    setPending({
      ...values,
      periodEnd: addMonths(values.periodStart, values.months),
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
          periodMonths: Number(pending.months),
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
              defaultValue={periodStart}
              required
            />
          </label>
          <label>
            Duration
            <select
              name="months"
              defaultValue={
                payment.periodMonths ||
                monthsBetween(periodStart, payment.periodEnd)
              }
            >
              <DurationOptions />
            </select>
          </label>
        </div>
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
        text={`${member.phone} · ${member.active ? status.label : "Deactivated"}`}
        onClose={close}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 pr-1">
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = valuesFrom(event.currentTarget);
    const duplicate = findMemberByIdentity(
      data.members,
      values.name,
      values.phone,
      member.id,
    );
    if (duplicate) {
      setError("Another member already uses this name and phone number.");
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
          planMonths: Number(values.planMonths),
          expiry: addMonths(values.planStart, values.planMonths),
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
                defaultValue={member.planStart || member.start}
                required
              />
            </label>
            <label>
              Duration
              <select
                name="planMonths"
                defaultValue={
                  member.planMonths ||
                  monthsBetween(member.planStart || member.start, member.expiry)
                }
              >
                <DurationOptions />
              </select>
            </label>
          </div>
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
              return (
                <option key={seat} value={seat} disabled={Boolean(conflict)}>
                  {seat}
                  {conflict
                    ? ` — occupied by ${conflict.name}`
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
  if (modal.type === "member" || modal.type === "member-reactivate")
    return (
      <MemberFormDialog
        modal={modal}
        data={data}
        shift={shift}
        commit={commit}
        close={close}
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
          commit={commit}
          close={close}
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
