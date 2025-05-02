import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function DonationFAQ() {
  return (
    <div className="my-16">
      <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
      <Accordion type="single" collapsible className="max-w-3xl mx-auto">
        <AccordionItem value="item-1" className="border-gray-700">
          <AccordionTrigger className="text-lg">Is my donation tax-deductible?</AccordionTrigger>
          <AccordionContent className="text-gray-300">
            Please consult with your tax advisor regarding the tax deductibility of your donation. We can provide
            receipts for all donations upon request.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2" className="border-gray-700">
          <AccordionTrigger className="text-lg">How will my donation be used?</AccordionTrigger>
          <AccordionContent className="text-gray-300">
            Your donation directly supports our operations, content creation, technology infrastructure, and channel
            expansion efforts. We are committed to transparency and use donations to further our mission of providing
            truthful, educational content.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-3" className="border-gray-700">
          <AccordionTrigger className="text-lg">Can I make a one-time donation?</AccordionTrigger>
          <AccordionContent className="text-gray-300">
            Yes! You can choose to make either a one-time donation or set up a recurring monthly contribution. Both
            options are available through our secure payment processor.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-4" className="border-gray-700">
          <AccordionTrigger className="text-lg">Is my payment information secure?</AccordionTrigger>
          <AccordionContent className="text-gray-300">
            Absolutely. We use Stripe, a PCI-compliant payment processor, to handle all transactions. Your payment
            information is encrypted and secure.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-5" className="border-gray-700">
          <AccordionTrigger className="text-lg">Can I donate if I'm outside the United States?</AccordionTrigger>
          <AccordionContent className="text-gray-300">
            Yes, we accept international donations. Stripe handles currency conversion automatically, so you can donate
            in your local currency.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
