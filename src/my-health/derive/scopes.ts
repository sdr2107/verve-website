/** What a grant may cover, in the words the page uses. */
export const SCOPE_LABEL: Record<string, string> = { labs: "Labs", imaging: "Imaging", activity: "Activity and fitness", body: "Body measurements", heart: "Sleep and heart", notes: "Notes" };
export const ALL_SCOPES = ["labs", "imaging", "activity", "body", "notes"];
export const scopeList = (xs: string[]) => xs.map((x) => SCOPE_LABEL[x] ?? x).join(" · ");
