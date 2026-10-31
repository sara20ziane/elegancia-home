import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n-context";
import {
  CODE_VERSION,
  UPSTREAM_REVIEWED_VERSION,
  SCHEMA_VERSION,
  isNewer,
  latestVersionQuery,
  schemaVersionQuery,
} from "@/lib/version";

/** Advisory only. No SQL execution, workflow trigger, or automatic update is provided. */
export function UpdateNotices() {
  const { t } = useI18n();
  const schema = useQuery(schemaVersionQuery());
  const latest = useQuery(latestVersionQuery());
  return (
    <section className="mb-5 flex flex-col gap-2 rounded-[14px] border border-outline bg-surface p-4 text-sm">
      <p>
        {t("version.current")} : <b>{CODE_VERSION}</b> · OpenStore {UPSTREAM_REVIEWED_VERSION}
      </p>
      <p>
        {t("version.expected")} : {SCHEMA_VERSION} · {schema.data ?? "—"}
      </p>
      {schema.isError && <p role="status">{t("version.unknown")}</p>}
      {schema.data !== undefined && schema.data < SCHEMA_VERSION && (
        <p role="alert" className="text-tertiary">
          {t("version.schema")}
        </p>
      )}
      {latest.data && (
        <p>
          {t("version.available")} : <b>{latest.data.version}</b> ·{" "}
          <a className="underline" href={latest.data.url} target="_blank" rel="noreferrer">
            {t("version.review")}
          </a>
          {isNewer(latest.data.version, UPSTREAM_REVIEWED_VERSION) ? " ↑" : ""}
        </p>
      )}
      <p className="text-xs text-on-surface-muted">{t("version.manual")}</p>
    </section>
  );
}
