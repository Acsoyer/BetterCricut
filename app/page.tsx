"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {ArrowRight,Check,Layers3,Scissors,Sparkles,WandSparkles} from "lucide-react";
import type {Session} from "@supabase/supabase-js";
import {supabase} from "./lib/supabase";
import "./landing.css";import "./landing-v31.css";import "./landing-v44.css";
declare global{interface Window{google?:{accounts:{id:{initialize(options:{client_id:string;callback:(response:{credential:string})=>void;auto_select?:boolean}):void;renderButton(element:HTMLElement,options:Record<string,string|number>):void;prompt():void}}}}}

const journey=[
["v1","The blank A4","We built the first real-size canvas, because guessing centimeters is how cake toppers become cake satellites."],
["v2","Backgrounds had to go","Background removal arrived—and taught us that the hole inside an O is, in fact, background too."],
["v3","Layers became layers","Thumbnails gained order, visibility and names, so overlapping artwork stopped behaving like a mystery pile."],
["v4","Handles with manners","Corners preserved proportions, side pills changed one axis, and resizing finally did what the cursor promised."],
["v5","Stroke, meet reality","Editable outward strokes appeared because a pretty design still needs enough material to survive a cutting machine."],
["v6","The acetate experiment","We created the translucent preview for the clear support sitting behind a finished topper."],
["v7","Export without archaeology","SVG, transparent PNG and A4 PDF became visible choices instead of technical rituals."],
["v8","Rulers learned their place","The rulers moved to the workspace edges and stayed put like Word and Photoshop users expect."],
["v9","Selecting what you meant","Repeated clicks began cycling overlapping layers, ending the reign of the permanently selected top object."],
["v10","Size became trustworthy","Width and height learned centimeters, decimals and ratio locking—12.5 cm now means 12.5 cm."],
["v11","The floating toolbox","Delete, duplicate, cut, copy and paste moved next to the selection instead of playing hide-and-seek."],
["v12","Rotation grew a brain","Selections rotate with artwork, angles update live and snapping prevents accidental 89-degree designs."],
["v13","Safe means safe","A visible 1 cm safe area began keeping every layer away from the printable cliff edge."],
["v14","Grid diplomacy","Grid detail started adapting to zoom: centimeters from afar, millimeters only when useful."],
["v15","Stroke finally worked","We rebuilt the stubborn command because a button labelled Stroke should, controversially, create a stroke."],
["v16","Color without confusion","Cutouts gained a practical palette and consistent dark edge so stacked pieces could be told apart."],
["v17","Acetate looked like acetate","Opacity and edge lighting returned without turning clear material into a shiny gradient sticker."],
["v18","Parametric, not destructive","Remove Background, Stroke and Fill Gaps became editable steps, so experiments stopped costing the original."],
["v19","Gaps, meet your match","Fill Gaps learned to close tiny enclosed holes without swallowing intentional spaces."],
["v20","Bake when ready","Bake Cutout arrived to commit the successful recipe only after the user finished tuning it."],
["v21","SVG stopped eating the canvas","Export bounds were rebuilt around artwork instead of blocks, fragments or enormous empty rectangles."],
["v22","Multiple means multiple","Selected cutouts could leave as separate SVGs, while raster designs received separate transparent PNGs."],
["v23","Pan was set free","The page became movable while zoomed out, because centering is helpful until one awkward corner needs inspection."],
["v24","The toolbar found a hierarchy","Actions were reorganised until the interface stopped looking like buttons waiting for a bus."],
["v25","Shapes joined the party","Circles, rectangles, triangles and custom shapes became instant cutouts—with Shift for perfect proportions."],
["v26","Crop what you see","Crop frames became draggable on the artwork, making the visible frame and final result agree."],
["v27","Erasers you can see","Brush, lasso and rectangle erasers gained visible cursors because invisible editing is mostly guessing."],
["v28","The offset exorcism","Popup brushes and crop coordinates were corrected so cursor and affected pixel occupied the same universe."],
["v29","Production housekeeping","We removed dead weight and prepared the project to live somewhere other than one heroic local folder."],
["v30","A front door","The editor gained a landing page and protected route instead of opening into a wall of tools."],
["v31","Google sign-in","Supabase and Google authentication turned the private experiment into somewhere real people could enter."],
["v32","Cloudflare, meet Cricut","GitHub deployment and Cloudflare hosting made improvements publishable instead of trapped on one computer."],
["v33","Projects became memorable","Saved canvases and account details meant closing the browser no longer meant goodbye forever."],
["v34","Low-resolution reality","We attacked staircase edges created when a tiny image is asked to become a large physical cut."],
["v35","Smoothing, take one","The first cleanup was better than nothing—and bad enough to make us try again. That is how useful software happens."],
["v36","Smoothing, take two","We changed algorithms instead of polishing a bad premise; better, but not cutting-machine better."],
["v37","VTracer enters","Open-source vector tracing joined the pipeline to create curves instead of enlarged pixel staircases."],
["v38","Three-minute honesty","Tracing gained a timer and clear failure message, because an endless Working screen is not a feature."],
["v39","The cutout finally worked","VTracer moved into a local worker and produced our first genuinely useful smooth birthday design."],
["v40","Make Cutout became good","The successful smooth pipeline replaced the weaker conversion, removing an unnecessary choice."],
["v41","Manual rescue tools","Bridges, crop, brush and erasers arrived for imperfections no automatic algorithm should guess."],
["v42","Fix the Edges","A local brush began repairing only the wobbly contour under the cursor while protecting good geometry."],
["v43","No more selecting empty space","We escaped the nonsense of selecting layers through transparent gaps, refined borders and fixed smaller screens."],
] as const;
const problems=[
["Skip the subscription maze","Prepare real Cricut artwork without learning Photoshop or Illustrator—or renting them forever."],
["Use the art you imagined","Bring AI-generated artwork instead of buying another pre-made template that looks like everybody else's."],
["Build the physical piece","Remove backgrounds, create cutouts, add welded support strokes and preview the acetate a topper needs."],
["Keep modest images useful","Improve masks and contours without demanding an absurdly high-resolution source image."],
] as const;

export default function LandingPage(){const[session,setSession]=useState<Session|null>(null),[busy,setBusy]=useState(false);const googleButton=useRef<HTMLDivElement>(null);
useEffect(()=>{void supabase.auth.getSession().then(({data})=>setSession(data.session));const{data}=supabase.auth.onAuthStateChange((_e,next)=>setSession(next));return()=>data.subscription.unsubscribe()},[]);
useEffect(()=>{if(session)return;const clientId=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID||"769733103078-1ifg8p2nqdfsukf0m3as9ilcfggcte2j.apps.googleusercontent.com";const setup=()=>{if(!window.google||!googleButton.current)return;window.google.accounts.id.initialize({client_id:clientId,auto_select:false,callback:async({credential})=>{setBusy(true);const{error}=await supabase.auth.signInWithIdToken({provider:"google",token:credential});if(error)setBusy(false);else window.location.assign("/editor")}});googleButton.current.replaceChildren();window.google.accounts.id.renderButton(googleButton.current,{type:"standard",theme:"outline",size:"large",shape:"pill",text:"continue_with",logo_alignment:"left",width:238})};const old=document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');if(old)window.google?setup():old.addEventListener("load",setup,{once:true});else{const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;s.defer=true;s.onload=setup;document.head.appendChild(s)}},[session]);
const signIn=()=>{setBusy(true);window.google?.accounts.id.prompt();window.setTimeout(()=>setBusy(false),1200)};
return <main className="story-site"><nav className="story-nav"><a className="story-brand" href="#top"><span><Scissors/></span><b>Better Cricut Editor</b></a><div className="story-links"><a href="#why">Why it exists</a><a href="#journey">43 versions</a></div>{session?<Link className="story-cta small" href="/editor">Open Editor <ArrowRight/></Link>:<button className="story-cta small" onClick={signIn} disabled={busy}>{busy?"Connecting…":"Sign in with Google"}</button>}</nav>
<section className="story-hero" id="top"><div className="hero-message"><span className="story-kicker"><Sparkles/> Built from 43 rounds of “that tiny thing is still annoying”</span><h1>Your idea.<br/><em>Your cut.</em><br/>Not another template.</h1><p>Turn AI-generated artwork into clean, correctly sized Cricut cutouts, cake toppers and printable designs—without becoming a Photoshop expert, subscribing to Illustrator, or buying the same recycled template again.</p><div className="story-actions">{session?<Link className="story-cta" href="/editor">Continue to the editor <ArrowRight/></Link>:<div ref={googleButton} className="official-google-button" aria-label="Continue with Google"/>}<a href="#journey">Read the build diary ↓</a></div></div><div className="hero-workflow"><div className="workflow-card"><small>01 · BRING YOUR IMAGE</small><div className="mini-art"><span>Happy</span><b>Birthday</b></div><p>JPG · PNG · SVG · WebP</p></div><div className="workflow-arrow">↓</div><div className="workflow-card cut-card"><small>02 · PREPARE THE CUT</small><div className="cut-shape"><span>Clean edges</span><i>+ editable support stroke</i></div></div><div className="workflow-arrow">↓</div><div className="workflow-card output-card"><small>03 · MAKE IT REAL</small><div><b>SVG</b><b>PNG</b><b>PDF</b></div><p>True size, ready to use</p></div></div></section>
<section className="manifesto" id="why"><header><span>THE ACTUAL PROBLEM</span><h2>Cricut creativity should not begin with three subscriptions and a design degree.</h2><p>The goal was simple: let a maker generate something personal with AI, prepare it properly, add the clear acetate support a real cake topper needs, and export it at the right physical size—all in one workspace.</p></header><div className="problem-grid">{problems.map(([title,text],i)=><article key={title}><span>0{i+1}</span><Check/><h3>{title}</h3><p>{text}</p></article>)}</div></section>
<section className="tool-story"><div><span className="section-label">FROM PIXELS TO A PHYSICAL OBJECT</span><h2>Not just “remove background.”<br/>Prepare what you will actually cut.</h2></div><div className="tool-list"><article><WandSparkles/><div><h3>Refine the mask</h3><p>Remove halos, protect important pieces, erase a chosen color and clean speckles without leaving semi-transparent pixels.</p></div></article><article><Scissors/><div><h3>Create the cutout</h3><p>Trace modest-resolution artwork into smoother vector geometry, then repair only the stubborn edge under your brush.</p></div></article><article><Layers3/><div><h3>Build the support</h3><p>Add an editable welded stroke and preview the translucent acetate holding separate design islands together.</p></div></article></div></section>
<section className="journey-section" id="journey"><header><span className="section-label">THE 43-VERSION BUILD DIARY</span><h2>Perfection, one ridiculous little annoyance at a time.</h2><p>No heroic rewrite. Just noticing what felt wrong, understanding why it mattered, and refusing to leave it that way.</p></header><div className="journey-grid">{journey.map(([version,title,text])=><article key={version}><b>{version}</b><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>
<section className="final-call"><span><Sparkles/></span><h2>Make the design yours.<br/>Then make it real.</h2><p>Better Cricut Editor is free while it is being developed.</p>{session?<Link className="story-cta" href="/editor">Open the editor <ArrowRight/></Link>:<button className="story-cta" onClick={signIn}>Continue with Google <ArrowRight/></button>}</section><footer className="story-footer"><b>Better Cricut Editor</b><span>Designed through 43 versions of stubborn attention to detail.</span><a href="#top">Back to top ↑</a></footer></main>}
