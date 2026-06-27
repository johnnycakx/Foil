#!/usr/bin/env python3
"""Round 8 — Poppins font, drop-shadowed number, arrow stacked above (centering fix),
proper Foil logo lockup + slogan. Collectr-grade."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=1080,1350
NAVY=(15,30,58); CREAM=(248,245,240); GOLD=(210,172,86); GOLD_L=(234,206,132); SLATE=(176,186,202); RED=(238,80,84); WHITE=(253,253,251)
G="/usr/share/fonts/truetype/google-fonts/"
def FB(s): return ImageFont.truetype(G+"Poppins-Bold.ttf",s)
def FM(s): return ImageFont.truetype(G+"Poppins-Medium.ttf",s)
def FR(s): return ImageFont.truetype(G+"Poppins-Regular.ttf",s)
def card_art(w,h):
    yy,xx=np.mgrid[0:h,0:w]; aa=np.zeros((h,w,3),float)
    aa[...,0]=28+72*(xx/w); aa[...,1]=120+115*(yy/h); aa[...,2]=180+70*(1-xx/w)
    for k,off in enumerate([-0.15,0.05,0.2]):
        s=np.exp(-((xx/w-yy/h-off)**2)/(2*0.03**2)); col=[(255,210,140),(180,240,255),(220,180,255)][k]
        aa=aa*(1-s[...,None]*0.4)+np.array(col)*(s[...,None]*0.4)
    return Image.fromarray(np.clip(aa,0,255).astype('uint8'))
def make_card(w=636):
    h=int(w*1.4); c=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(c); r=int(w*0.05)
    d.rounded_rectangle([0,0,w,h],r,fill=(240,234,222,255)); d.rounded_rectangle([7,7,w-7,h-7],r-3,outline=GOLD,width=7)
    nb=int(h*0.085); d.rounded_rectangle([int(w*.045),int(h*.03),w-int(w*.045),nb+int(h*.03)],12,fill=NAVY)
    d.text((int(w*.08),int(h*.043)),"Blastoise",font=FB(int(h*.04)),fill=CREAM); d.text((w-int(w*.27),int(h*.05)),"HP 100",font=FM(int(h*.028)),fill=GOLD_L)
    ay0=int(h*.13); ay1=h-int(h*.185); art=card_art(w-int(w*.09),ay1-ay0); ci=Image.new("L",art.size,0)
    ImageDraw.Draw(ci).rounded_rectangle([0,0,art.width,art.height],10,fill=255); c.paste(art,(int(w*.045),ay0),ci)
    d.text((int(w*.08),h-int(h*.15)),"Special Illustration Rare",font=FM(int(h*.025)),fill=(28,40,66))
    d.text((int(w*.08),h-int(h*.10)),"Base Set  ·  #2",font=FB(int(h*.028)),fill=(28,40,66))
    return c,art
def dominant(art): return tuple(np.asarray(art.resize((40,56)),float).reshape(-1,3).mean(0))
def derived_bg(art,dom):
    big=art.convert("RGB").resize((W,int(W*art.height/art.width)))
    if big.height<H: big=art.convert("RGB").resize((int(H*art.width/art.height),H))
    bx=(big.width-W)//2; by=(big.height-H)//2; big=big.crop((bx,by,bx+W,by+H)).filter(ImageFilter.GaussianBlur(85))
    arr=np.asarray(big,float)*0.5; arr=arr*0.72+np.array(NAVY)*0.28
    yy,xx=np.mgrid[0:H,0:W]; halo=np.clip(1-np.sqrt((xx/W-.5)**2+(yy/H-.34)**2)/0.5,0,1)**2
    arr=arr+halo[...,None]*np.array(dom)*0.32
    v=np.clip(1-np.sqrt((xx/W-.5)**2+(yy/H-.42)**2)*1.12,0,1)[...,None]; arr=arr*(0.42+0.58*v)
    return Image.fromarray(np.clip(arr,0,255).astype('uint8')).convert("RGBA")
def ctext(img,cx,y,text,font,fill,shadow=True,soff=8,sblur=10,salpha=200,ls=0):
    d=ImageDraw.Draw(img)
    if ls:
        # letter-spaced: render manually
        widths=[d.textlength(ch,font=font)+ls for ch in text]; tot=sum(widths)-ls; x=cx-tot/2
        if shadow:
            sh=Image.new("RGBA",img.size,(0,0,0,0)); ds=ImageDraw.Draw(sh); xx=x
            for ch,wd in zip(text,widths): ds.text((xx,y+soff),ch,font=font,fill=(0,0,0,salpha)); xx+=wd
            img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(sblur)))
        for ch,wd in zip(text,widths): d.text((x,y),ch,font=font,fill=fill); x+=wd
        return
    w=d.textlength(text,font=font); x=cx-w/2
    if shadow:
        sh=Image.new("RGBA",img.size,(0,0,0,0)); ImageDraw.Draw(sh).text((x,y+soff),text,font=font,fill=(0,0,0,salpha))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(sblur)))
    d.text((x,y),text,font=font,fill=fill)
def logo(img,cx,y):
    """Gold mark + 'Foil TCG' lockup, centered."""
    d=ImageDraw.Draw(img); f=FB(40); fo="Foil"; tc=" TCG"; mk=54
    wfo=d.textlength(fo,font=f); wtc=d.textlength(tc,font=f); tot=mk+16+wfo+wtc; x=cx-tot/2
    # mark: gold rounded square with a foil glint
    d.rounded_rectangle([x,y,x+mk,y+mk],12,fill=GOLD)
    d.line([x+12,y+mk-12,x+mk-12,y+12],fill=(255,245,220),width=5)
    tx=x+mk+16
    # shadow
    sh=Image.new("RGBA",img.size,(0,0,0,0)); ImageDraw.Draw(sh).text((tx,y+6+6),fo+tc,font=f,fill=(0,0,0,170)); img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
    d.text((tx,y+6),fo,font=f,fill=CREAM); d.text((tx+wfo,y+6),tc,font=f,fill=GOLD_L)
def soft_shadow(card,blur=44,a=190):
    s=Image.new("RGBA",(card.width+180,card.height+180),(0,0,0,0)); sh=Image.new("RGBA",card.size,(0,0,0,a)); s.paste(sh,(90,108),card.split()[3]); return s.filter(ImageFilter.GaussianBlur(blur))
def render(name,gold_number=False):
    card,art=make_card(636); dom=dominant(art); img=derived_bg(art,dom)
    cx=(W-card.width)//2; cy=150
    gl=Image.new("RGBA",img.size,(0,0,0,0)); gl.paste(Image.new("RGBA",card.size,tuple(int(v) for v in dom)+(150,)),(cx,cy),card.split()[3]); img.alpha_composite(gl.filter(ImageFilter.GaussianBlur(55)))
    img.alpha_composite(soft_shadow(card),(cx-90,cy-108)); img.alpha_composite(card,(cx,cy))
    # logo + slogan (once, top)
    logo(img,W/2,52); ctext(img,W/2,124,"FIND.   TRACK.   SAVE.",FM(20),GOLD_L,shadow=True,soff=4,sblur=5,ls=2)
    # arrow stacked above, number centered (centering fix)
    ctext(img,W/2,H-356,"▼",FB(58),RED,shadow=True,soff=6,sblur=10)
    numcol=GOLD_L if gold_number else WHITE
    ctext(img,W/2,H-300,"17%",FB(136),numcol,shadow=True,soff=12,sblur=14,salpha=210)
    ctext(img,W/2,H-150,"below its 30-day sold average",FM(34),CREAM,shadow=True,soff=5,sblur=8)
    ctext(img,W/2,H-96,"Blastoise · Base Set · Near Mint · $120 avg · 51 sales",FR(23),SLATE,shadow=True,soff=3,sblur=5)
    ctext(img,W/2,H-50,"foiltcg.com",FM(25),GOLD_L,shadow=True,soff=3,sblur=5)
    img.convert("RGB").save(f"/sessions/beautiful-affectionate-hopper/mnt/outputs/{name}.png")
render("r8_white",False); render("r8_gold",True)
a=Image.open("/sessions/beautiful-affectionate-hopper/mnt/outputs/r8_white.png").resize((380,475)); b=Image.open("/sessions/beautiful-affectionate-hopper/mnt/outputs/r8_gold.png").resize((380,475))
m=Image.new("RGB",(800,495),(28,28,32)); m.paste(a,(10,10)); m.paste(b,(410,10)); m.save("/sessions/beautiful-affectionate-hopper/mnt/outputs/r8_compare.png"); print("done round8")
