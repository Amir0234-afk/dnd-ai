import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { newSession, uploadMd } from "../services/api";
import { saveLocalMemory } from "../utils/localMemory";

const RACES = [
  "Human", "Elf", "Dwarf", "Halfling", "Gnome",
  "Half-Elf", "Half-Orc", "Tiefling", "Dragonborn",
];

const CLASSES = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter",
  "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard",
];

const BACKGROUNDS = [
  "Acolyte", "Criminal", "Folk Hero", "Noble", "Outlander",
  "Sage", "Soldier", "Urchin", "Entertainer", "Guild Artisan",
];

const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8,
  Sorcerer: 6, Wizard: 6,
};

const SKILLS = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
  "History", "Insight", "Intimidation", "Investigation", "Medicine",
  "Nature", "Perception", "Performance", "Persuasion", "Religion",
  "Sleight of Hand", "Stealth", "Survival",
];

const STAT_NAMES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

interface Stats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

function rollStat(): number {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => a - b);
  return rolls.slice(1).reduce((a, b) => a + b, 0);
}

function modifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function generateMd(character: {
  name: string;
  race: string;
  characterClass: string;
  background: string;
  stats: Stats;
  skills: string[];
  traits: string;
  bonds: string;
  flaws: string;
  backstory: string;
  gold: number;
  level: number;
}): string {
  const hp = CLASS_HIT_DIE[character.characterClass] ?? 8;
  return `# Character Sheet — ${character.name}

## Identity
- **Name:** ${character.name}
- **Race:** ${character.race}
- **Class:** ${character.characterClass}
- **Background:** ${character.background}
- **Level:** ${character.level}

## Stats
| Stat | Score | Modifier |
|---|---|---|
| Strength | ${character.stats.strength} | ${modifier(character.stats.strength)} |
| Dexterity | ${character.stats.dexterity} | ${modifier(character.stats.dexterity)} |
| Constitution | ${character.stats.constitution} | ${modifier(character.stats.constitution)} |
| Intelligence | ${character.stats.intelligence} | ${modifier(character.stats.intelligence)} |
| Wisdom | ${character.stats.wisdom} | ${modifier(character.stats.wisdom)} |
| Charisma | ${character.stats.charisma} | ${modifier(character.stats.charisma)} |

## Combat
- **HP:** ${hp} (Level 1 max)
- **Hit Die:** d${hp}
- **Proficiency Bonus:** +2
- **Initiative:** ${modifier(character.stats.dexterity)}
- **AC:** 10 + ${modifier(character.stats.dexterity)} (base)

## Proficient Skills
${character.skills.map((s) => `- ${s}`).join("\n")}

## Gold
${character.gold}gp

## Personality
**Traits:** ${character.traits}
**Bonds:** ${character.bonds}
**Flaws:** ${character.flaws}

## Backstory
${character.backstory}
`;
}

export default function CharacterCreation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [race, setRace] = useState("");
  const [characterClass, setCharacterClass] = useState("");
  const [background, setBackground] = useState("");
  const [stats, setStats] = useState<Stats>({
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [traits, setTraits] = useState("");
  const [bonds, setBonds] = useState("");
  const [flaws, setFlaws] = useState("");
  const [backstory, setBackstory] = useState("");
  const [gold, setGold] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const statKeys = Object.keys(stats) as (keyof Stats)[];

  const rollAllStats = () => {
    setStats({
      strength: rollStat(),
      dexterity: rollStat(),
      constitution: rollStat(),
      intelligence: rollStat(),
      wisdom: rollStat(),
      charisma: rollStat(),
    });
  };

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleFinish = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await newSession();
      const session = res.data;

      const character = {
        name, race, characterClass, background,
        stats, skills, traits, bonds, flaws, backstory, gold, level: 1,
      };

      const md = generateMd(character);
      const blob = new Blob([md], { type: "text/markdown" });
      const file = new File([blob], "character.md");
      await uploadMd(session.session_id, file);
      saveLocalMemory(session.session_id, md);

      navigate(`/game/${session.session_id}`);
    } catch {
      setError("Failed to create character.");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: "Identity",
      valid: name && race && characterClass && background,
      render: () => (
        <div className="cc-fields">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Character name" />
          </label>
          <label>
            Race
            <select value={race} onChange={(e) => setRace(e.target.value)}>
              <option value="">— Select —</option>
              {RACES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label>
            Class
            <select value={characterClass} onChange={(e) => setCharacterClass(e.target.value)}>
              <option value="">— Select —</option>
              {CLASSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>
            Background
            <select value={background} onChange={(e) => setBackground(e.target.value)}>
              <option value="">— Select —</option>
              {BACKGROUNDS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label>
            Starting Gold
            <input
              type="number"
              min={0}
              value={gold}
              onChange={(e) => setGold(parseInt(e.target.value) || 0)}
            />
          </label>
        </div>
      ),
    },
    {
      title: "Ability Scores",
      valid: true,
      render: () => (
        <div className="cc-stats">
          <button onClick={rollAllStats}>🎲 Roll All Stats (4d6 drop lowest)</button>
          <div className="stat-grid">
            {statKeys.map((key, i) => (
              <div key={key} className="stat-block">
                <label>{STAT_NAMES[i]}</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={stats[key]}
                  onChange={(e) =>
                    setStats((prev) => ({ ...prev, [key]: parseInt(e.target.value) || 10 }))
                  }
                />
                <span className="mod">{modifier(stats[key])}</span>
              </div>
            ))}
          </div>
          <p className="hint">Standard array: 15, 14, 13, 12, 10, 8</p>
        </div>
      ),
    },
    {
      title: "Skills",
      valid: true,
      render: () => (
        <div className="cc-skills">
          <p>Select your proficient skills.</p>
          <div className="skill-grid">
            {SKILLS.map((skill) => (
              <button
                key={skill}
                className={skills.includes(skill) ? "active" : ""}
                onClick={() => toggleSkill(skill)}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "Backstory",
      valid: true,
      render: () => (
        <div className="cc-fields">
          <label>
            Personality Traits
            <textarea value={traits} onChange={(e) => setTraits(e.target.value)} rows={2} />
          </label>
          <label>
            Bonds
            <textarea value={bonds} onChange={(e) => setBonds(e.target.value)} rows={2} />
          </label>
          <label>
            Flaws
            <textarea value={flaws} onChange={(e) => setFlaws(e.target.value)} rows={2} />
          </label>
          <label>
            Backstory
            <textarea value={backstory} onChange={(e) => setBackstory(e.target.value)} rows={4} />
          </label>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div className="character-creation">
      <div className="cc-header">
        <button onClick={() => navigate("/lobby")}>← Back</button>
        <h1>Create Character</h1>
        <span>{step + 1} / {steps.length}</span>
      </div>

      <div className="cc-steps">
        {steps.map((s, i) => (
          <div key={i} className={`cc-step ${i === step ? "active" : i < step ? "done" : ""}`}>
            {s.title}
          </div>
        ))}
      </div>

      <div className="cc-body">
        <h2>{current.title}</h2>
        {current.render()}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="cc-footer">
        {step > 0 && (
          <button onClick={() => setStep((p) => p - 1)}>← Back</button>
        )}
        {step < steps.length - 1 ? (
          <button
            className="primary"
            disabled={!current.valid}
            onClick={() => setStep((p) => p + 1)}
          >
            Continue →
          </button>
        ) : (
          <button className="primary" onClick={handleFinish} disabled={loading}>
            {loading ? "Creating..." : "Begin Adventure →"}
          </button>
        )}
      </div>
    </div>
  );
}
