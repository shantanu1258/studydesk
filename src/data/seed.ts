import {
  DEFAULT_ATTENDANCE_ENABLED,
  DEFAULT_FEE_COLLECTION,
  DEFAULT_MONTHLY_FEE,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  DEFAULT_SHIFTS,
} from "../config/constants";
import type { WorkspaceData } from "../types/domain";
import { addMonths, localDate, uid } from "../utils/format";

const MEMBER_ROWS: Array<[string, string, string, string, number, number]> = [
  ["Riya Mehta", "9876543210", "A-07", "Morning", 1200, 18],
  ["Aman Joshi", "9811122233", "A-02", "Morning", 1200, 26],
  ["Neha Verma", "9899012345", "A-19", "Morning", 1500, 30],
  ["Vikas Kumar", "9700011223", "A-12", "Morning", 1200, 2],
  ["Kavya Singh", "9911223344", "A-03", "Morning", 1200, 5],
  ["Mohit Gupta", "9822334455", "A-15", "Morning", 1200, -3],
  ["Sana Khan", "9777888990", "A-04", "Evening", 1200, 22],
  ["Rahul Yadav", "9888777665", "A-08", "Evening", 1200, 12],
  ["Ishita Rao", "9666555443", "A-11", "Evening", 1500, 28],
  ["Dev Patel", "9555444332", "A-14", "Full Day", 2200, 16],
  ["Ananya Das", "9444333221", "A-18", "Full Day", 2200, 4],
  ["Saurabh Jain", "9333222110", "A-21", "Full Day", 2200, 35],
];

export function seedData(
  library = "The Focus Room",
  empty = false,
): WorkspaceData {
  const today = localDate();
  const offset = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDate(date);
  };

  const members = empty
    ? []
    : MEMBER_ROWS.map((row, index) => ({
        id: `member-${index + 1}`,
        name: row[0],
        phone: row[1],
        seat: row[2],
        shift: row[3],
        fee: row[4],
        start: offset(index - 40),
        planStart: offset(row[5] - 30),
        planMonths: 1,
        expiry: offset(row[5]),
        active: true,
      }));

  return {
    settings: {
      seatCount: 24,
      prefix: "A",
      seatSections: [
        {
          id: "main-section",
          name: "Main section",
          prefix: "A",
          start: 1,
          end: 24,
          defaultFee: DEFAULT_MONTHLY_FEE,
        },
      ],
      library,
      shifts: structuredClone(DEFAULT_SHIFTS),
      feeCollection: DEFAULT_FEE_COLLECTION,
      attendanceEnabled: DEFAULT_ATTENDANCE_ENABLED,
      trackDemoVisitors: false,
      primaryColor: DEFAULT_PRIMARY_COLOR,
      secondaryColor: DEFAULT_SECONDARY_COLOR,
      isFounder: true,
    },
    members,
    fees: empty
      ? []
      : [
          {
            id: uid(),
            memberId: "member-2",
            memberName: "Aman Joshi",
            seat: "A-02",
            amount: 1200,
            date: today,
            mode: "UPI",
            periodStart: today,
            periodMonths: 1,
            periodEnd: addMonths(today, 1),
          },
          {
            id: uid(),
            memberId: "member-1",
            memberName: "Riya Mehta",
            seat: "A-07",
            amount: 1200,
            date: offset(-2),
            mode: "Cash",
            periodStart: offset(-2),
            periodMonths: 1,
            periodEnd: addMonths(offset(-2), 1),
          },
        ],
    attendance: empty
      ? []
      : [
          {
            id: uid(),
            memberId: "member-1",
            date: today,
            in: "08:42",
            out: "",
          },
          {
            id: uid(),
            memberId: "member-2",
            date: today,
            in: "09:05",
            out: "",
          },
        ],
    demoSeats: [],
  };
}
