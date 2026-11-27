"use client";

import { useEffect, useRef, useState } from "react";
import { BREEDS, LIMITS, QUALITIES, REFUGO_REASONS, SEX_TYPES, categoryOf, isFemale, isRefugo, label } from "../../lib/catalog";
import Select from "../_ui/Select";
import NumberStepper from "../_ui/NumberStepper";
import DateTimePicker from "../_ui/DateTimePicker";
import MediaGallery, { ACCEPT_MEDIA, checkFile, uploadMedia } from "./MediaGallery";
import { arrivalError, formatDateTime, toLocalInput } from "../../lib/datetime";

// arrivedAt começa com a hora atual e segue o relógio até o usuário alterar (dateEdited)
const EMPTY = { kind: "NORMAL", farm: "", arrivedAt: "", dateEdited: false, quantity: "", sexType: "", ageMonths: "", breed: "", quality: "", reason: "", notes: "" };

const FIELDS = [
  { key: "farm", id: "des-farm", label: "Fazenda" },
  { key: "arrivedAt", id: "des-date", label: "Data e hora" },
  { key: "quantity", id: "des-qty", label: "Quantidade" },
  { key: "sexType", id: "des-sex", label: "Sexo / Tipo" },
  { key: "ageMonths", id: "des-age", label: "Idade" },
  { key: "breed", id: "des-breed", label: "Raça" },
  { key: "quality", id: "des-quality", label: "Qualidade" },
  { key: "reason", id: "des-reason", label: "Motivo do refugo" },
  { key: "notes", id: "des-notes", label: "Observações" },
];

function intError(value, max, what) {
  if (value === "") return `Informe ${what}.`;
  const n = Number(value);
  if (!Number.isInteger(n)) return "Use apenas números inteiros.";
  if (n < 1) return "Deve ser maior que zero.";
  if (n > max) return `Máximo de ${max.toLocaleString("pt-BR")}.`;
  return "";
}

function validate(form) {
  const refugo = form.kind === "REFUGO";
  const errors = {
    farm: form.farm ? "" : "Escolha a fazenda de origem do gado.",
    arrivedAt: form.dateEdited ? arrivalError(form.arrivedAt && new Date(form.arrivedAt)) : "",
    quantity: intError(form.quantity, LIMITS.quantity, "a quantidade de cabeças"),
    sexType: form.sexType ? "" : "Escolha o sexo / tipo.",
    ageMonths: intError(form.ageMonths, LIMITS.ageMonths, "a idade em meses"),
    breed: form.breed ? "" : "Escolha a raça.",
    quality: form.quality ? "" : "Escolha a qualidade.",
    reason: !refugo || form.reason ? "" : "Escolha o motivo do refugo.",
    notes: !refugo ? ""
      : form.reason === "OUTRO" && form.notes.trim().length < 3 ? "Descreva o problema."
      : form.notes.length > 500 ? "Máximo de 500 caracteres." : "",
  };
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

function FieldError({ id, message }) {
  return message ? <p className="ferr" id={id} role="alert">{message}</p> : null;
}

const KIND_TABS = [
  { id: "ALL", label: "Todos" },
  { id: "NORMAL", label: "Normal" },
  { id: "REFUGO", label: "Refugo" },
];

export default function CattleForm({ records, farms = [], lots = [], onAdd, onEntryChange }) {
  const [form, setForm] = useState(EMPTY);

  // data e hora automáticas: acompanham o relógio enquanto o usuário não alterar
  useEffect(() => {
    const tick = () => setForm((f) => (f.dateEdited ? f : { ...f, arrivedAt: toLocalInput() }));
    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, []);
  const [files, setFiles] = useState([]); // anexos escolhidos antes de salvar
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(null); // { done, total, progress }
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [gallery, setGallery] = useState(null); // id do registro com a galeria aberta
  const fileInput = useRef(null);
  const galleryRef = useRef(null);

  const refugo = form.kind === "REFUGO";
  const errors = validate(form);
  const show = (key) => (submitted || touched[key]) && errors[key];
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }));
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSubmitError("");
  };

  // previews dos anexos escolhidos (liberados ao trocar a lista)
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    const d = galleryRef.current;
    if (gallery && d && !d.open) d.showModal();
    if (!gallery && d?.open) d.close();
  }, [gallery]);

  function pickFiles(list) {
    const arr = [...list];
    const problems = arr.map(checkFile).filter(Boolean);
    setFileError(problems.join(" "));
    setFiles((f) => [...f, ...arr.filter((x) => !checkFile(x))].slice(0, 20));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    const first = FIELDS.find((f) => errors[f.key]);
    if (first) {
      document.getElementById(first.id)?.focus();
      return;
    }
    setSaving(true);
    try {
      const { dateEdited, ...rest } = form;
      const arrivedAt = (dateEdited ? new Date(form.arrivedAt) : new Date()).toISOString();
      const payload = refugo ? { ...rest, arrivedAt } : { ...rest, arrivedAt, reason: "", notes: "" };
      let entry = await onAdd(payload);
      // anexos: enviados um por vez depois que o registro existe
      if (refugo && files.length) {
        for (const [i, f] of files.entries()) {
          setUploading({ done: i, total: files.length, progress: 0 });
          entry = await uploadMedia(entry.id, f, (p) => setUploading({ done: i, total: files.length, progress: p }));
          onEntryChange(entry);
        }
      }
      setForm({ ...EMPTY, arrivedAt: toLocalInput() });
      setFiles([]);
      setTouched({});
      setSubmitted(false);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSaving(false);
      setUploading(null);
    }
  }

  const farmNames = [...new Set(farms.map((f) => f.farmName).filter(Boolean))];
  const lotByEntry = new Map(lots.flatMap((l) => l.entryIds.map((id) => [id, l.lot])));
  const errorCount = Object.keys(errors).length;
  const preview = form.sexType && !errors.ageMonths ? categoryOf(form.sexType, form.ageMonths) : null;

  const visible = records.filter((r) => filter === "ALL" || (filter === "REFUGO") === isRefugo(r));
  const heads = records.reduce((s, r) => s + Number(r.quantity), 0);
  const females = records.filter((r) => isFemale(r.sexType)).reduce((s, r) => s + Number(r.quantity), 0);
  const refugoHeads = records.filter(isRefugo).reduce((s, r) => s + Number(r.quantity), 0);
  const waiting = records.filter((r) => !lotByEntry.has(r.id)).reduce((s, r) => s + Number(r.quantity), 0);
  const countKind = (k) => (k === "ALL" ? records.length : records.filter((r) => (k === "REFUGO") === isRefugo(r)).length);
  const openEntry = gallery ? records.find((r) => r.id === gallery) : null;

  const fieldClass = (key, extra = "") => `fld${show(key) ? " has-err" : ""}${extra}`;

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className={refugo ? "is-refugo" : ""}>
        {submitted && errorCount > 0 && (
          <div className="vbox" role="alert">
            <span className="vbox-ico" aria-hidden="true">!</span>
            <div>
              <strong>Revise {errorCount === 1 ? "1 campo" : `${errorCount} campos`} antes de salvar</strong>
              <ul>
                {FIELDS.filter((f) => errors[f.key]).map((f) => (
                  <li key={f.key}>
                    <a href={`#${f.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(f.id)?.focus(); }}>
                      {f.label}
                    </a>: {errors[f.key]}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tipo do gado: normal ou refugo */}
        <fieldset className="kind-seg">
          <legend>Tipo do gado</legend>
          <div className="ks-opts" style={{ "--idx": refugo ? 1 : 0 }}>
            <span className="ks-ind" aria-hidden="true" />
            {["NORMAL", "REFUGO"].map((k) => (
              <label key={k} className={form.kind === k ? "on" : ""}>
                <input type="radio" name="des-kind" value={k} checked={form.kind === k} onChange={() => set("kind", k)} />
                {k === "NORMAL" ? "Gado normal" : "Refugo (com problema)"}
              </label>
            ))}
          </div>
          {refugo && <p className="ks-hint">Animais com doença, lesão ou outro problema. Informe o motivo e anexe fotos ou vídeos para o proprietário.</p>}
        </fieldset>

        <div className="grid">
          <div className={fieldClass("farm", " wide")}>
            <label htmlFor="des-farm">Fazenda</label>
            <Select id="des-farm" value={form.farm} onChange={(v) => set("farm", v)} onBlur={() => touch("farm")}
              invalid={Boolean(show("farm"))} describedBy={show("farm") ? "des-farm-err" : "des-farm-hint"}
              placeholder={farmNames.length ? "Selecione a fazenda…" : "Nenhuma fazenda cadastrada"}
              options={farmNames.map((n) => ({ value: n, label: n }))} />
            <FieldError id="des-farm-err" message={show("farm")} />
            {farmNames.length === 0 && (
              <p className="hint" id="des-farm-hint">Cadastre uma fazenda na aba Fazenda para registrar o desembarque.</p>
            )}
          </div>
          <div className={fieldClass("arrivedAt")}>
            <label htmlFor="des-date">Data e hora do desembarque</label>
            <DateTimePicker id="des-date" value={form.arrivedAt} invalid={Boolean(show("arrivedAt"))}
              describedBy="des-date-err des-date-hint" onBlur={() => touch("arrivedAt")}
              onChange={(v) => { setForm((f) => ({ ...f, arrivedAt: v, dateEdited: true })); setSubmitError(""); }}
              badge={form.dateEdited ? <span className="dt-edit">Ajustado</span> : <span className="dt-auto">Automático</span>} />
            <FieldError id="des-date-err" message={show("arrivedAt")} />
            {!show("arrivedAt") && (
              <p className="hint" id="des-date-hint">
                {form.dateEdited ? (
                  <>Data e hora ajustadas manualmente. <button type="button" className="linkbtn"
                    onClick={() => setForm((f) => ({ ...f, arrivedAt: toLocalInput(), dateEdited: false }))}>Usar agora</button></>
                ) : "Preenchido com a hora atual. Toque para alterar, se precisar."}
              </p>
            )}
          </div>
          <div className={fieldClass("quantity")}>
            <label htmlFor="des-qty">Quantidade (cabeças)</label>
            <NumberStepper id="des-qty" value={form.quantity} onChange={(v) => set("quantity", v)} onBlur={() => touch("quantity")}
              min={1} max={LIMITS.quantity} placeholder="Ex.: 12" unit="cab." invalid={Boolean(show("quantity"))} describedBy="des-qty-err" />
            <FieldError id="des-qty-err" message={show("quantity")} />
          </div>
          <div className={fieldClass("sexType")}>
            <label htmlFor="des-sex">Sexo / Tipo</label>
            <Select id="des-sex" value={form.sexType} onChange={(v) => set("sexType", v)} onBlur={() => touch("sexType")}
              invalid={Boolean(show("sexType"))} describedBy="des-sex-err"
              options={SEX_TYPES.map((s) => ({ value: s, label: label(s) }))} />
            <FieldError id="des-sex-err" message={show("sexType")} />
          </div>
          <div className={fieldClass("ageMonths")}>
            <label htmlFor="des-age">Idade (meses)</label>
            <NumberStepper id="des-age" value={form.ageMonths} onChange={(v) => set("ageMonths", v)} onBlur={() => touch("ageMonths")}
              min={1} max={LIMITS.ageMonths} placeholder="Ex.: 18" unit="meses" invalid={Boolean(show("ageMonths"))} describedBy="des-age-err" />
            <FieldError id="des-age-err" message={show("ageMonths")} />
          </div>
          <div className={fieldClass("breed")}>
            <label htmlFor="des-breed">Raça</label>
            <Select id="des-breed" value={form.breed} onChange={(v) => set("breed", v)} onBlur={() => touch("breed")}
              invalid={Boolean(show("breed"))} describedBy="des-breed-err"
              options={BREEDS.map((b) => ({ value: b, label: label(b) }))} />
            <FieldError id="des-breed-err" message={show("breed")} />
          </div>
          <div className={fieldClass("quality")}>
            <label htmlFor="des-quality">Qualidade</label>
            <Select id="des-quality" value={form.quality} onChange={(v) => set("quality", v)} onBlur={() => touch("quality")}
              invalid={Boolean(show("quality"))} describedBy="des-quality-err"
              options={QUALITIES.map((q) => ({ value: q, label: label(q) }))} />
            <FieldError id="des-quality-err" message={show("quality")} />
          </div>
          <div className="fld cat-preview" aria-live="polite">
            <span className="cp-label">Categoria</span>
            {preview ? <span className="cp-val">{label(preview)}</span> : <span className="cp-empty">Escolha o sexo e a idade</span>}
            <span className="cp-hint">Calculada automaticamente</span>
          </div>

          {refugo && (
            <div className="refugo-box wide">
              <div className="rb-head">
                <span className="rb-ico" aria-hidden="true">!</span>
                <strong>Dados do refugo</strong>
              </div>
              <div className="grid">
                <div className={fieldClass("reason")}>
                  <label htmlFor="des-reason">Motivo do refugo</label>
                  <Select id="des-reason" value={form.reason} onChange={(v) => set("reason", v)} onBlur={() => touch("reason")}
                    invalid={Boolean(show("reason"))} describedBy="des-reason-err"
                    options={REFUGO_REASONS.map((r) => ({ value: r, label: label(r) }))} />
                  <FieldError id="des-reason-err" message={show("reason")} />
                </div>
                <div className={fieldClass("notes")}>
                  <label htmlFor="des-notes">Observações {form.reason !== "OUTRO" && <span className="opt">(opcional)</span>}</label>
                  <textarea id="des-notes" rows={3} maxLength={500} placeholder="Ex.: manca da pata traseira esquerda, em tratamento"
                    aria-invalid={show("notes") ? "true" : "false"} aria-describedby="des-notes-err"
                    value={form.notes} onChange={(e) => set("notes", e.target.value)} onBlur={() => touch("notes")} />
                  <span className="count">{form.notes.length}/500</span>
                  <FieldError id="des-notes-err" message={show("notes")} />
                </div>
                <div className="fld wide">
                  <span className="lbl">Fotos e vídeos para o proprietário <span className="opt">(opcional)</span></span>
                  <div className="pick-files"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); pickFiles(e.dataTransfer.files); }}>
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="pf-item">
                        {f.type.startsWith("image/")
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={previews[i]} alt="" />
                          : <video src={previews[i]} muted />}
                        <span className="pf-name">{f.name}</span>
                        <button type="button" className="pf-x" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label={`Remover ${f.name}`}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="pf-add" onClick={() => fileInput.current?.click()}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v14h-2zM5 11h14v2H5z" /></svg>
                      <span>Adicionar fotos ou vídeos</span>
                      <small>ou arraste aqui · JPG, PNG, MP4, MOV</small>
                    </button>
                    <input ref={fileInput} type="file" multiple accept={ACCEPT_MEDIA} hidden
                      onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
                  </div>
                  {fileError && <p className="ferr" role="alert">{fileError}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {uploading && (
          <div className="up-status" role="status">
            Enviando anexo {uploading.done + 1} de {uploading.total}… {uploading.progress}%
            <span className="up-bar"><span style={{ width: `${uploading.progress}%` }} /></span>
          </div>
        )}
        {submitError && (
          <div className="vbox" role="alert">
            <span className="vbox-ico" aria-hidden="true">!</span>
            <div><strong>Não foi possível salvar</strong><p>{submitError}</p></div>
          </div>
        )}
        <button type="submit" disabled={saving}>
          {saving ? (uploading ? "Enviando anexos…" : "Salvando…") : refugo ? "Registrar refugo" : "Registrar desembarque"}
        </button>
      </form>

      <div className="list-head">
        <h2>Desembarques registrados</h2>
        <div className="chips-row" role="group" aria-label="Filtrar por tipo">
          {KIND_TABS.map((t) => (
            <button key={t.id} type="button" className={`kchip${filter === t.id ? " on" : ""}${t.id === "REFUGO" ? " kc-refugo" : ""}`}
              aria-pressed={filter === t.id} onClick={() => setFilter(t.id)}>
              {t.label} <em>{countKind(t.id)}</em>
            </button>
          ))}
        </div>
      </div>
      {records.length === 0 ? (
        <div className="empty-card">
          <strong>Nenhum desembarque registrado ainda</strong>
          <p>Os registros aparecem aqui e ficam disponíveis para vincular na aba Lotes.</p>
        </div>
      ) : (
        <>
          <div className="tbl tbl-lots">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th><th>Desembarque</th><th>Fazenda</th><th>Qtd.</th><th>Sexo / Tipo</th><th>Idade</th>
                  <th>Raça</th><th>Categoria</th><th>Qualidade</th><th>Anexos</th><th>Lote</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const lot = lotByEntry.get(r.id);
                  const n = r.media?.length ?? 0;
                  return (
                    <tr key={r.id} className={isRefugo(r) ? "row-refugo" : ""}>
                      <td>
                        {isRefugo(r)
                          ? <span className="kind-pill refugo" title={r.notes || undefined}>Refugo · {label(r.reason)}</span>
                          : <span className="kind-pill">Normal</span>}
                      </td>
                      <td className="nowrap">{formatDateTime(r.arrivedAt ?? r.createdAt)}</td>
                      <td>{r.farm}</td>
                      <td>{r.quantity}</td>
                      <td>{label(r.sexType)}</td>
                      <td>{r.ageMonths} m</td>
                      <td>{label(r.breed)}</td>
                      <td>{label(categoryOf(r.sexType, r.ageMonths))}</td>
                      <td>{r.quality ? label(r.quality) : "—"}</td>
                      <td>
                        {isRefugo(r) || n ? (
                          <button type="button" className="media-btn" onClick={() => setGallery(r.id)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zm2 2v8l4-4 3 3 2-2 3 3V7zm9 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" /></svg>
                            {n ? `${n} ${n === 1 ? "anexo" : "anexos"}` : "Anexar"}
                          </button>
                        ) : "—"}
                      </td>
                      <td>
                        {lot ? <span className="lot-pill">Lote {String(lot).padStart(2, "0")}</span>
                          : <span className="lot-pill wait">Sem lote</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <dl className="totals">
            <div><dt>Registros</dt><dd>{records.length}</dd></div>
            <div><dt>Cabeças</dt><dd>{heads}</dd></div>
            <div><dt>Fêmeas</dt><dd>{females}</dd></div>
            <div><dt>Machos</dt><dd>{heads - females}</dd></div>
            <div className="t-refugo"><dt>Cabeças de refugo</dt><dd>{refugoHeads}</dd></div>
            <div><dt>Cabeças sem lote</dt><dd>{waiting}</dd></div>
          </dl>
        </>
      )}

      {/* Galeria do registro (fotos e vídeos para o proprietário) */}
      <dialog ref={galleryRef} className="gdialog" onClose={() => setGallery(null)} aria-labelledby="gd-title">
        {openEntry && (
          <div className="gd-box">
            <header className="gd-head">
              <div>
                <span className="gd-kick">{isRefugo(openEntry) ? `Refugo · ${label(openEntry.reason)}` : "Gado normal"}</span>
                <h3 id="gd-title">{openEntry.quantity} {label(categoryOf(openEntry.sexType, openEntry.ageMonths))} · {openEntry.farm}</h3>
                <p className="gd-date">Desembarque em {formatDateTime(openEntry.arrivedAt ?? openEntry.createdAt)}</p>
                {openEntry.notes && <p className="gd-notes">“{openEntry.notes}”</p>}
              </div>
              <button type="button" className="gd-x" onClick={() => setGallery(null)} aria-label="Fechar">✕</button>
            </header>
            <MediaGallery entry={openEntry} onChange={onEntryChange} editable />
          </div>
        )}
      </dialog>
    </>
  );
}
