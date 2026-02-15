# Pitch: SketchySniffer

We are addressing Prompt #1: enhancing critical thinking through problem solving and reflection. 

When browsing online marketplaces like Kijiji and Facebook Marketplace, people often act on impulse rather than reflection. The excitement of a “great deal” can override caution.

These platforms are filled with legitimate sellers, but also scammers and bad actors. In the rush to secure a bargain, users may overlook red flags, ignore the feeling that something is “too good to be true,” and put themselves at financial or physical risk.

To solve this problem, We built **SketchySniffer,** an AI-powered decision reflection tool for high-risk online interactions. 

Users paste a marketplace listing into our platform. Then we use AI to analyze the content for common scam patterns. 

So now I’d like I’d like to dive straight into the demo. I’d like to get some audience participation. Could one of the judges please give me an item you might search for on a marketplace. 
[gets item name]
[finds listing]

So now what I will do is go to [sketchysniffer.com](http://sketchysniffer.com) and paste this link into the box and hit the Sniff button. 

The System will now fetch the listing data, and analyze 30 data points across the listing, seller profile, and even page metadata, and compare it to 20 risk signals. 

The analysis works using a hybrid approach of deterministic rule-based checks, such as missing images or keyword detection, and AI semantic analysis for more subjective checks such as description coherence and how reasonable the price is. 

We then combine the results to with a risk scoring model that assigns weights to different signals to generate a conclusive risk sore. 

As you can see, the tool then provides:

- The risk rating
- A clear explanation of detected red flags
- Insight into cognitive biases being triggered

But we do not stop at detection. The tool then prompts users with some questions based on the detected red flags to encourage learning and understanding the patterns. 

Instead of replacing critical thinking, we support it. The user remains in control, but now with awareness. **A tool like this does NOT EXIST in the current market.**

[Katie]

The outcome is enhanced user safety while teaching practical critical thinking skills. Users learn to recognize red flags, understand emotional triggers, and pause before acting on impulse. building habits hard → integrate habit into other thingksjklsfjla

AI is rapidly becoming embedded in our workflows. Rather than using AI to think for us, we will use it to strengthen our **thinking**. Our goal is not automation of judgment, but cultivation of it.

---

## Actions the user takes:

- Goes to [sketchysniffer.com](http://sketchysniffer.com) and is presented with a big box to paste a link
- pastes link into the box and presses a big (sniff) button
    - the sniff button is a nose with a hover over effect of nostrils expanding
- is presented with the results and a sketch score
- can scroll down to see more details and explanation: why did it give this score?
- can scroll further and is presented with up to 3 quiz questions specific to the red flags found
    - preset questions with specific answers
- Answer correctness is immediately displayed to the user with feedback
- The final prompt to the user is a Final Decision Prompt asking: “After reviewing this, what do you want to do?” with buttons:
    - Proceed cautiously
    - Message seller with verification questions
    - Walk away
- The buttons are not functional, but they
    - Reinforce agency
    - Give a moment to decide after learning about the red flags
    - Provide closure

# UI Planning

## Overall feel:

- Minimal but deliberate
- Slightly playful (nose/sniff branding)
- Clean but interesting typography (hand-serif)
- Soft neutral background

### Page 1: Link-Paste Page

- Top left: logo and name
- Top right: navbar items (these arent real pages for now)
    - How it works
    - Why this matters
    - Login button - highlighted and more prominent
- Center of page
    - Title: “Paste a marketplace listing.”
    - Subtitle: “We’ll help you spot red flags and think clearly before acting.”
    - Paste box - large rounded rectangle with a placeholder example link
    - Large button labeled “👃 Sniff & Reflect”
        - Hover animation where nostrils expand and inhale
    - Small text saying “We don’t make decisions for you. We help you think through them.”

### Page 2: Analysis Page

- Same navbar as prev page
- Everything else centered
- Top of page: Sketch score card
    - large prominent card with accent color
    - Accent color is either red, yellow, green, depending on score
    - Circular completion bar with score inside of it
    - Bar is filled with the score from 0 - 100
    - Short sentance summarizing the result
- Below: Why This Score?
    - Bullet cards listing the red flags found
    - Color coded based on severity (maybe?)
    - Click to expand and get more explanation as to why it matters
- Below: Reflection Quiz Section
    - Up to 3 questions based on the red flags
    - multiple choice or T/F
    - immediate feedback
- Below: Final Decision Prompt
    - In a card: “After reviewing this, what do you want to do?”
    - Three button options:
        - Proceed cautiously
        - Ask seller verification questions
        - Walk away
    - Clicking a button just selects it - no function
    - Text below: “The final decision is always yours.”
- At the very bottom: button to sniff again
    - Goes back to page 1

