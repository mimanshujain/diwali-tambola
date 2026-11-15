import {setTimeout as delay} from 'node:timers/promises';

// Short generated test tone. Exercise actual MP3 playback without provider credentials.
const tone=Buffer.from('//MgxAAIAD7FGUMAAqEpLhwHd3f4ju4GBuHyigQdB8HwfP5QMZcH//BN+JwQcJiXvj8yYf/zIsQHCrh6lAGaOADDBbHKDKBGOGC/BHJIYjDQgHIqUIQcgt/HhsNuCoS8GhKd+DT944yR//MgxAQI6FZYAd0AAECC4bGAoSAITjBcXjJMeD7dUTJobygQGvISnnf2NV7N/96uvUY68f/zIMQHCdBKIADn9ECnqw5BYwBoARNdiHcAmKPCmgwqithYW1fv/6P/v///+tXdx6TARwf/8yDEBgmgSiAAB/QIeUqYagBMAbAFjXOSGEHxhoSzaEz1gI///6Dn/vd///611VgoxtZ2//MixAYIAEYoAAc+BALWlBjADgA80bocgDAIlIJ5ZFeHs/9H//+T3cgkx/ZGBNZUFMAPAEj/8yDEDgeYSigABz4E0ZEfLCAIZIF5pDfwFf//8ir1CxjqYspcpYxgEAHn587IEA2qSgWe//MgxBYG4EYsAD88ILw9n//++v/POniAhBokAgwaBAwpEMMIs6JRUxGAgwHA0umrt9L2rP/zIMQhCHhWYAFdAABnuEIDrEgFlsABgWMtUcOBBoJ8DxUMXfg3aDwwAHBQYUAUwmJmF/j/8yLEJg8ownABnFAAEZILf5P/5ZzCT5S/9IDej/oc6//+b0IbYnQxVg3LA3ghpdwbyjUQO//zIMQRDNCmoAGSOACAED0ZovFwsG614+OKO+WMA4rxURAN/5QLkDIQ/4sHDYDFqkxBTUX/8yDEBAAAA0gBwAAAMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq','base64');
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options)=>{
 if(typeof url!=='string'||!url.startsWith('https://api.elevenlabs.io/v1/text-to-speech/'))return originalFetch(url,options);
 if(options?.headers['xi-api-key']!=='elevenlabs-rehearsal-key')return new Response(null,{status:401});
 const {text,model_id,language_code}=JSON.parse(options.body);
 const expectedVoice=text.includes('48')?'voice-haryanvi':'voice-hi';
 if(!url.includes('/'+expectedVoice+'?')||language_code!=='hi')return new Response(null,{status:404});
 if(model_id!=='eleven_v3'||!text.startsWith('[excited] '))return new Response(null,{status:422});
 if(text.includes('88'))return new Response(null,{status:429});
 if(text.includes('47'))await delay(18_000,undefined,{signal:options.signal});
 return new Response(tone,{headers:{'content-type':'audio/mpeg'}});
};
