import { useState } from "react";
import { createTriviaRun, type TriviaQuestion } from "./model";
import { TRIVIA_QUESTIONS } from "./questions";
import "./trivia.css";

export type { TriviaQuestion } from "./model";
export { TRIVIA_QUESTIONS } from "./questions";

export interface TriviaResult {
  gameId: "trivia";
  correctAnswers: number;
  totalQuestions: number;
  archetype: string;
}

interface TriviaGameProps {
  onComplete: (result: TriviaResult) => void;
}

function celebratorType(correctAnswers: number, totalQuestions: number) {
  const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
  if (accuracy >= 0.8) return "Шинэ жилийн баярлагч — Баярын мэдлэгтэн";
  if (accuracy >= 0.5) return "Шинэ жилийн баярлагч — Хөгжилтэй зохион байгуулагч";
  return "Шинэ жилийн баярлагч — Цасан ширхэгт мөрөөдөгч";
}

export default function TriviaGame({ onComplete }: TriviaGameProps) {
  const [questions, setQuestions] = useState<TriviaQuestion[]>(() => createTriviaRun(TRIVIA_QUESTIONS));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<TriviaResult | null>(null);
  const question = questions[questionIndex];

  function submitAnswer() {
    if (selectedIndex === null || submitted) return;
    if (selectedIndex === question.correctIndex) setCorrectAnswers((score) => score + 1);
    setSubmitted(true);
  }

  function showResult() {
    const archetype = celebratorType(correctAnswers, questions.length);
    const finalResult: TriviaResult = {
      gameId: "trivia",
      correctAnswers,
      totalQuestions: questions.length,
      archetype,
    };
    setResult(finalResult);
    setFinished(true);
    onComplete(finalResult);
  }

  function nextQuestion() {
    if (!submitted || questionIndex >= questions.length - 1) return;
    setQuestionIndex((index) => index + 1);
    setSelectedIndex(null);
    setSubmitted(false);
  }

  function restart() {
    setQuestions(createTriviaRun(TRIVIA_QUESTIONS));
    setQuestionIndex(0);
    setSelectedIndex(null);
    setSubmitted(false);
    setCorrectAnswers(0);
    setFinished(false);
    setResult(null);
  }

  if (finished && result) {
    return (
      <section className="trivia-game trivia-result" aria-labelledby="trivia-result-title">
        <span className="trivia-result__icon" aria-hidden="true">✦</span>
        <p className="trivia-kicker">ТАНЫ ҮР ДҮН</p>
        <h2 id="trivia-result-title">{result.archetype}</h2>
        <p className="trivia-score">{result.correctAnswers} / {result.totalQuestions} зөв хариулт</p>
        <button className="trivia-button trivia-button--primary" type="button" onClick={restart}>Дахин тоглох</button>
      </section>
    );
  }

  return (
    <section className="trivia-game" aria-labelledby="trivia-question">
      <div className="trivia-progress" aria-label={`Асуулт ${questionIndex + 1} / ${questions.length}`}>
        <span>Асуулт {questionIndex + 1} / {questions.length}</span>
        <span>{correctAnswers} зөв</span>
      </div>
      <div className="trivia-progress-track" aria-hidden="true"><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
      <h2 id="trivia-question">{question.prompt}</h2>
      <div className="trivia-answers" role="group" aria-label="Хариултаа сонгох">
        {question.answers.map((answer, index) => (
          <button
            className={`trivia-answer${selectedIndex === index ? " is-selected" : ""}${submitted && index === question.correctIndex ? " is-correct" : ""}${submitted && selectedIndex === index && index !== question.correctIndex ? " is-incorrect" : ""}`}
            key={answer}
            type="button"
            aria-pressed={selectedIndex === index}
            disabled={submitted}
            onClick={() => setSelectedIndex(index)}
          >{answer}</button>
        ))}
      </div>
      {submitted && <p className="trivia-feedback" role="status">{selectedIndex === question.correctIndex ? "Зөв хариуллаа!" : `Зөв хариулт: ${question.answers[question.correctIndex]}`}</p>}
      <div className="trivia-actions">
        {!submitted ? (
          <button className="trivia-button trivia-button--primary" type="button" onClick={submitAnswer} disabled={selectedIndex === null}>Хариулах</button>
        ) : questionIndex < questions.length - 1 ? (
          <button className="trivia-button trivia-button--primary" type="button" onClick={nextQuestion}>Дараагийн асуулт</button>
        ) : (
          <button className="trivia-button trivia-button--primary" type="button" onClick={showResult}>Үр дүн харах</button>
        )}
      </div>
    </section>
  );
}
