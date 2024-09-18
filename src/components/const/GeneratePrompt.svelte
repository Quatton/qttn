<script lang="ts">
  import { keys, rules, type RuleType } from "@/lib/const/rules";
  import { cn } from "@/lib/utils";
  import { actions } from "astro:actions";
  import { navigate } from "astro:transitions/client";

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

  async function generatePrompt() {
    const { data } = await actions.constAction.new({
      rules: selectedRules,
    });

    if (data) {
      navigate(`/game/${data}`);
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

  <div class="flex justify-center">
    <button class="btn btn-wide btn-primary mt-4" on:click={generatePrompt}
      >Generate</button
    >
  </div>
</div>
