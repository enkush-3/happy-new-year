import { useState } from "react";
import "./trivia.css";

export interface TriviaQuestion {
  prompt: string;
  answers: [string, string, string, string];
  correctIndex: number;
}

export interface TriviaResult {
  gameId: "trivia";
  correctAnswers: number;
  totalQuestions: 10;
  archetype: string;
}

interface TriviaGameProps {
  onComplete: (result: TriviaResult) => void;
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { prompt: "Григорийн тооллын шинэ жил хэдэн сарын хэдэнд эхэлдэг вэ?", answers: ["1-р сарын 1", "2-р сарын 1", "12-р сарын 24", "3-р сарын 1"], correctIndex: 0 },
  { prompt: "Өндөр жилд аль сард 29 хоног байдаг вэ?", answers: ["1-р сар", "2-р сар", "6-р сар", "12-р сар"], correctIndex: 1 },
  { prompt: "Шинэ он гарахын өмнө хүмүүс түгээмэл хэдээс тоолж эхэлдэг вэ?", answers: ["3-аас", "5-аас", "10-аас", "100-аас"], correctIndex: 2 },
  { prompt: "Шинэ жилийн зорилго гэж юуг хэлэх вэ?", answers: ["Ирэх жил хийхээр төлөвлөсөн зүйл", "Өнгөрсөн жилийн дурсамж", "Бэлгийн жагсаалт", "Цаг агаарын мэдээ"], correctIndex: 0 },
  { prompt: "Гацуурын оройд түгээмэл ямар чимэглэл тавьдаг вэ?", answers: ["Од", "Гутал", "Ном", "Цаг"], correctIndex: 0 },
  { prompt: "Шөнө дунд болоход цаг хэдийг заадаг вэ?", answers: ["23:00", "00:00", "12:30", "01:00"], correctIndex: 1 },
  { prompt: "Цасан ширхэгийн талст ихэвчлэн хэдэн талт симметртэй вэ?", answers: ["4", "5", "6", "8"], correctIndex: 2 },
  { prompt: "Бэлгийг бооход ихэвчлэн юу хэрэглэдэг вэ?", answers: ["Бэлгийн цаас", "Элс", "Шил", "Навч"], correctIndex: 0 },
  { prompt: "Жилийн сүүлийн сар аль вэ?", answers: ["10-р сар", "11-р сар", "12-р сар", "1-р сар"], correctIndex: 2 },
  { prompt: "Шинэ жилийг угтахад хамгийн тохирох зүйл аль вэ?", answers: ["Сайхан хүсэл, баяр хөөр", "Өдөр тутмын шалгалт", "Өвлийн бэлтгэлээ мартах", "Бусдыг яаруулах"], correctIndex: 0 },
];

function celebratorType(correctAnswers: number) {
  if (correctAnswers >= 8) return "Шинэ жилийн баярлагч — Баярын мэдлэгтэн";
  if (correctAnswers >= 5) return "Шинэ жилийн баярлагч — Хөгжилтэй зохион байгуулагч";
  return "Шинэ жилийн баярлагч — Цасан ширхэгт мөрөөдөгч";
}

export default function TriviaGame({ onComplete }: TriviaGameProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<TriviaResult | null>(null);
  const question = TRIVIA_QUESTIONS[questionIndex];

  function submitAnswer() {
    if (selectedIndex === null || submitted) return;
    if (selectedIndex === question.correctIndex) setCorrectAnswers((score) => score + 1);
    setSubmitted(true);
  }

  function showResult() {
    const archetype = celebratorType(correctAnswers);
    const finalResult: TriviaResult = {
      gameId: "trivia",
      correctAnswers,
      totalQuestions: 10,
      archetype,
    };
    setResult(finalResult);
    setFinished(true);
    onComplete(finalResult);
  }

  function nextQuestion() {
    if (!submitted || questionIndex >= TRIVIA_QUESTIONS.length - 1) return;
    setQuestionIndex((index) => index + 1);
    setSelectedIndex(null);
    setSubmitted(false);
  }

  function restart() {
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
        <p className="trivia-score">{result.correctAnswers} / 10 зөв хариулт</p>
        <button className="trivia-button trivia-button--primary" type="button" onClick={restart}>Дахин тоглох</button>
      </section>
    );
  }

  return (
    <section className="trivia-game" aria-labelledby="trivia-question">
      <div className="trivia-progress" aria-label={`Асуулт ${questionIndex + 1} / 10`}>
        <span>Асуулт {questionIndex + 1} / 10</span>
        <span>{correctAnswers} зөв</span>
      </div>
      <div className="trivia-progress-track" aria-hidden="true"><span style={{ width: `${((questionIndex + 1) / 10) * 100}%` }} /></div>
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
        ) : questionIndex < TRIVIA_QUESTIONS.length - 1 ? (
          <button className="trivia-button trivia-button--primary" type="button" onClick={nextQuestion}>Дараагийн асуулт</button>
        ) : (
          <button className="trivia-button trivia-button--primary" type="button" onClick={showResult}>Үр дүн харах</button>
        )}
      </div>
    </section>
  );
}
