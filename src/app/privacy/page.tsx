export const metadata = { title: "Privacy Policy · Industry Event Scout" };

export default function Privacy() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-xl font-bold">Privacy Policy</h1>
      <p className="text-slate-500">Industry Event Scout is a personal, single-user tool. Last updated 11 October 2026.</p>

      <h2 className="pt-2 text-base font-semibold">What it accesses</h2>
      <p>
        With the owner&apos;s consent, the app reads the owner&apos;s own Gmail messages that are Google Alerts, LinkedIn notification emails, or emails the
        owner forwards or labels for the app (scope <code>gmail.readonly</code>), and sends the owner a weekly digest email (scope{" "}
        <code>gmail.send</code>).
      </p>

      <h2 className="pt-2 text-base font-semibold">How data is used</h2>
      <p>
        Event details found in those emails (titles, dates, links and short text snippets) are stored in the owner&apos;s own database and sent to Google&apos;s
        Gemini API to classify and rank events. Email content is used only for this purpose.
      </p>

      <h2 className="pt-2 text-base font-semibold">Sharing and retention</h2>
      <p>
        Data is not sold, shared with third parties, or used for advertising or model training by the app. It stays in the owner&apos;s database until the
        owner deletes it. Access can be revoked at any time at{" "}
        <a className="text-blue-700 underline" href="https://myaccount.google.com/permissions">
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <h2 className="pt-2 text-base font-semibold">Google API Services</h2>
      <p>
        The app&apos;s use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use
        requirements.
      </p>
    </article>
  );
}
