import { useState } from 'react';
import { reportFormSchema } from '../mockData';
import { Card, PageHeader, Badge, Button, Field, inputClass } from '../ui';

export default function ReportFormBuilder() {
  const [fields, setFields] = useState(reportFormSchema.fields);

  const moveField = (index: number, dir: -1 | 1) => {
    setFields(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        title="The monthly report form"
        description={`Version ${reportFormSchema.version}, live since ${reportFormSchema.liveSince}. Editing publishes a new version — past submissions keep the version they were filed against.`}
      />

      <Card>
        {fields.map((field, i) => (
          <div key={field.key} className={`p-4 flex items-center justify-between gap-4 ${i < fields.length - 1 ? 'border-b border-border-light' : ''}`}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[13.5px] font-semibold text-text-primary">{field.label}</span>
              <Badge>{field.type}</Badge>
              {field.required && <Badge tone="pink">Required</Badge>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" onClick={() => moveField(i, -1)} disabled={i === 0}>↑</Button>
              <Button variant="ghost" onClick={() => moveField(i, 1)} disabled={i === fields.length - 1}>↓</Button>
              <Button variant="secondary">Edit</Button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-4 mt-4 flex items-end gap-3 flex-wrap">
        <Field label="Add a field">
          <input className={`${inputClass} w-56`} placeholder="Field label" />
        </Field>
        <Button>Add field</Button>
      </Card>

      <div className="flex gap-2 mt-6">
        <Button>Publish new version</Button>
        <Button variant="secondary">Preview</Button>
      </div>
    </div>
  );
}
