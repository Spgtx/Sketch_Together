import { StudioIcon } from '@/components/StudioIcon';
import type { Template } from '@/lib/boards';

type Option = {
  id: Template;
  name: string;
  prompt: string;
  image: string;
};

const OPTIONS: Option[] = [
  {
    id: 'blank',
    name: 'A fresh thought',
    prompt: 'Nothing on the page. Anything can happen.',
    image: '/art/world/template-blank.svg',
  },
  {
    id: 'brainstorm',
    name: 'Idea explosion',
    prompt: 'The good, the odd, the what-ifs.',
    image: '/art/world/template-brainstorm.svg',
  },
  {
    id: 'flow',
    name: 'Connect the dots',
    prompt: 'See where one thought leads.',
    image: '/art/world/template-flow.svg',
  },
  {
    id: 'retro',
    name: 'Look back / look up',
    prompt: 'Keep what worked. Try what is next.',
    image: '/art/world/template-retro.svg',
  },
];

type Props = {
  onCreate: (template: Template) => void;
  disabled: boolean;
};

export function TemplateShelf({ onCreate, disabled }: Props) {
  return (
    <section className="world-templates world-width" id="templates"
      aria-labelledby="templates-title">
      {/*<span className="world-index">03 / BORROW A STARTING POINT</span>*/}
      <div className="world-templates-intro">
        <h2 id="templates-title">Every good mess<br /><em>starts somewhere.</em></h2>
        <p>Pick a little nudge. Everything on the page is yours to change.</p>
      </div>
      <div className="world-template-collection">
        {OPTIONS.map((option, index) => (
          <button
            className={`world-template world-template-${option.id}`}
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onCreate(option.id)}
            aria-label={`Create a board using ${option.name}`}
          >
            <span className="world-template-art">
              <img src={option.image} alt="" draggable={false} />
            </span>
            <span className="world-template-number">{/*0{index + 1} / TAKE THIS ONE*/}</span>
            <strong>{option.name} <StudioIcon name="arrow-up-right" size={15} /></strong>
            <span className="world-template-prompt">{option.prompt}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
