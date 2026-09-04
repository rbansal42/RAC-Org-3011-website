import { useState } from 'react';
import { Card, PageHeader, Field, inputClass, Button } from '../ui';

export default function AdHocRequest() {
  const [questions, setQuestions] = useState(['']);

  return (
    <div>
      <PageHeader
        title="Ask clubs for something else"
        description="A one-off return, separate from the monthly report. Four questions, a deadline, and who has to answer."
      />

      <Card className="p-6 space-y-5 max-w-[600px]">
        <Field label="Title"><input className={inputClass} placeholder="e.g. Mahadan Week camp headcount" /></Field>
        <Field label="Deadline"><input type="date" className={inputClass} /></Field>
        <Field label="Who has to answer">
          <select className={inputClass}>
            <option>All 75 clubs</option>
            <option>Presidents only</option>
            <option>One zone</option>
          </select>
        </Field>
        {questions.map((_, i) => (
          <Field key={i} label={`Question ${i + 1}`}>
            <input className={inputClass} placeholder="Type the question" />
          </Field>
        ))}
        <Button variant="secondary" onClick={() => setQuestions(q => [...q, ''])} disabled={questions.length >= 4}>
          Add question ({questions.length}/4)
        </Button>
        <div className="pt-2">
          <Button>Send to clubs</Button>
        </div>
      </Card>
    </div>
  );
}
