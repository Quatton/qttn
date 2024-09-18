<script lang="ts">
  import { cn } from "@/lib/utils";

  const rules = {
    beginWithLetter: "Only begin with Letter [A-Z]",
    useGivenWords: "Use given words/phrases in order",
    // includeColor: "Include a color in every sentence",
    // includeNumber: "Include a number in every sentence",
    // syllableWords: "Only [number]-syllable words",
  } as const;

  type RuleType = keyof typeof rules;

  const keys = Object.keys(rules) as RuleType[];

  let selectedRules: RuleType[] = [];

  function toggleRule(rule: RuleType) {
    if (isRuleSelected(rule)) {
      selectedRules = selectedRules.filter(
        (selectedRule) => selectedRule !== rule,
      );
    } else {
      selectedRules = [...selectedRules, rule];
    }
  }

  $: isRuleSelected = (rule: RuleType) => {
    return selectedRules.includes(rule);
  };

  const alphabets = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  let prompt = "";

  async function generatePrompt() {
    if (selectedRules.length === 0) {
      alert("Please select at least one rule");
      return;
    }

    prompt = "";
    // Generate prompt based on selected rules
    // 1. Begin with letter
    // 2. Use given words/phrases in order

    if (isRuleSelected("beginWithLetter")) {
      const randomLetter =
        alphabets[Math.floor(Math.random() * alphabets.length)];
      prompt += `Begin with letter ${randomLetter}. `;
    }

    if (isRuleSelected("useGivenWords")) {
      prompt += "Use given the following words/phrases in order: ";

      const url = "https://random-word-api.herokuapp.com/word?number=10";

      const response = await fetch(url);
      const words = (await response.json()) as string[];

      prompt += words.join(", ");

      prompt += ". ";
    }
  }

  const colors = [
    "bg-red-200",
    "bg-green-200",
    "bg-blue-200",
    "bg-yellow-200",
    "bg-purple-200",
    "bg-pink-200",
    "bg-indigo-200",
    "bg-teal-200",
    "bg-orange-200",
  ];

  function getColorClass(rule: RuleType) {
    const hash = rule
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorIndex = hash % colors.length;
    return colors[colorIndex];
  }
</script>

<div class="flex flex-col items-center gap-8">
  <h3 class="text-3xl font-semibold">Generate Prompt</h3>
  <p class="text-sm text-gray-600">
    Select the rules you want to include in the prompt
  </p>
  <div class="flex flex-wrap justify-center gap-2">
    {#each keys as rule}
      <button
        class={cn(
          "btn btn-ghost",
          "btn-sm",
          !isRuleSelected(rule) && "btn-outline",
          isRuleSelected(rule) && getColorClass(rule),
        )}
        on:click={() => toggleRule(rule)}
      >
        {rules[rule]}
      </button>
    {/each}
  </div>

  <div class="mt-4">
    <p class="text-sm text-gray-600">{prompt}</p>
  </div>

  <div class="flex justify-center">
    <button class="btn btn-wide btn-primary mt-4" on:click={generatePrompt}
      >Generate</button
    >
  </div>
</div>
